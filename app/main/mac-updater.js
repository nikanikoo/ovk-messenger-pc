'use strict'

const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const crypto = require('crypto')
const URL = require('url')
const EventEmitter = require('events')
const childProcess = require('child_process')
const zlib = require('zlib')
const { app } = require('electron')

function execute(command, args) {
  return new Promise((resolve, reject) => {
    childProcess.execFile(command, args, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

function remove(directory) {
  if (!fs.existsSync(directory)) return
  for (const name of fs.readdirSync(directory)) {
    const file = path.join(directory, name)
    if (fs.lstatSync(file).isDirectory()) remove(file)
    else fs.unlinkSync(file)
  }
  fs.rmdirSync(directory)
}

function assertContained(root, file) {
  const relative = path.relative(root, file)
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Update archive contains a path outside the application')
  }
}

function validateArchive(archive) {
  const zip = fs.readFileSync(archive)
  let end = zip.length - 22
  const lower = Math.max(0, end - 65535)
  for (; end >= lower; end--) {
    if (zip.readUInt32LE(end) === 0x06054b50 && end + 22 + zip.readUInt16LE(end + 20) === zip.length) break
  }
  if (end < lower) throw new Error('Invalid update ZIP')
  const entries = zip.readUInt16LE(end + 10)
  if (zip.readUInt16LE(end + 4) || zip.readUInt16LE(end + 6) || entries === 65535) {
    throw new Error('Unsupported multipart or ZIP64 update')
  }
  let offset = zip.readUInt32LE(end + 16)
  function safeName(name) {
    if (!name || name.includes('\0') || name.includes('\\') || name.startsWith('/') ||
        /^[A-Za-z]:/.test(name) || name.split('/').includes('..')) throw new Error('Unsafe path in update ZIP')
  }
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > end || zip.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP directory')
    const nameSize = zip.readUInt16LE(offset + 28)
    const next = offset + 46 + nameSize + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32)
    if (next > end) throw new Error('Invalid ZIP entry')
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameSize)
    safeName(name)
    if (zip.readUInt16LE(offset + 8) & 1) throw new Error('Encrypted update archives are unsupported')
    const mode = zip.readUInt32LE(offset + 38) >>> 16
    if ((mode & 0o170000) === 0o120000) {
      const compressedSize = zip.readUInt32LE(offset + 20)
      const local = zip.readUInt32LE(offset + 42)
      if (compressedSize > 8192 || zip.readUInt32LE(offset + 24) > 4096 || local + 30 > zip.length ||
          zip.readUInt32LE(local) !== 0x04034b50) throw new Error('Invalid ZIP symlink')
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
      if (start + compressedSize > zip.length) throw new Error('Invalid ZIP symlink data')
      const method = zip.readUInt16LE(offset + 10)
      const bytes = zip.slice(start, start + compressedSize)
      const target = (method === 0 ? bytes : method === 8 ? zlib.inflateRawSync(bytes) : Buffer.alloc(0)).toString('utf8')
      if (!target || target.length > 4096 || target.includes('\0') || target.includes('\\') || target.startsWith('/')) {
        throw new Error('Unsafe update symlink')
      }
      safeName(path.posix.normalize(path.posix.join(path.posix.dirname(name), target)))
    }
    offset = next
  }
}

function validateLinks(root, directory = root) {
  root = fs.realpathSync(root)
  for (const name of fs.readdirSync(directory)) {
    const file = path.join(directory, name)
    const stat = fs.lstatSync(file)
    if (stat.isSymbolicLink()) assertContained(root, fs.realpathSync(file))
    else if (stat.isDirectory()) validateLinks(root, file)
    else if (!stat.isFile()) throw new Error('Unsupported file in update archive')
  }
}

function findBundle(directory, depth = 3) {
  const bundles = []
  for (const name of fs.readdirSync(directory)) {
    if (name === '__MACOSX' || name.startsWith('.')) continue
    const file = path.join(directory, name)
    if (!fs.lstatSync(file).isDirectory()) continue
    if (name.endsWith('.app')) bundles.push(file)
    else if (depth > 0) bundles.push.apply(bundles, findBundle(file, depth - 1))
  }
  return bundles
}

async function validateBundle(bundle, build) {
  validateLinks(bundle)
  const plist = JSON.parse(await execute('/usr/bin/plutil', [
    '-convert', 'json', '-o', '-', path.join(bundle, 'Contents/Info.plist')
  ]))
  if (plist.CFBundleIdentifier !== 'com.electron.openvk') throw new Error('The update is not an OpenVK Messenger application')
  const name = plist.CFBundleExecutable
  if (!name || path.basename(name) !== name) throw new Error('Invalid update executable')
  const executable = path.join(bundle, 'Contents/MacOS', name)
  fs.accessSync(executable, fs.constants.X_OK)
  await execute('/usr/bin/lipo', [executable, '-verify_arch', 'x86_64'])
  const packageFile = path.join(bundle, 'Contents/Resources/app/package.json')
  const metadata = JSON.parse(fs.readFileSync(packageFile, 'utf8'))
  if (Number(metadata.build) !== Number(build)) throw new Error('Update build does not match the manifest')
  fs.accessSync(path.join(bundle, 'Contents/Resources/app/main.js'), fs.constants.R_OK)
}

const installScript = `#!/bin/sh
set -u
parent_pid=$1
current=$2
staged=$3
backup=$4
log_file=$5
work=$6
launcher=$7
shift 7
exec >> "$log_file" 2>&1
attempt=0
while kill -0 "$parent_pid" 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 300 ]; then
    echo "The application did not exit; the installed application was not changed."
    exit 1
  fi
  /bin/sleep 0.1
done
if ! /bin/mv "$current" "$backup"; then
  echo "Cannot move the installed application."
  "$launcher" -n "$current" --args "$@"
  exit 1
fi
if ! /bin/mv "$staged" "$current"; then
  /bin/mv "$backup" "$current"
  "$launcher" -n "$current" --args "$@"
  echo "Replacement failed; restored the previous application."
  exit 1
fi
if ! "$launcher" -n "$current" --args "$@"; then
  /bin/mv "$current" "$staged"
  /bin/mv "$backup" "$current"
  "$launcher" -n "$current" --args "$@"
  echo "Launch failed; restored the previous application."
  exit 1
fi
/bin/rm -rf "$backup" "$work"
`

class MacUpdater extends EventEmitter {
  constructor(options = {}) {
    super()
    this.options = options
    this.update = null
    this.work = null
    this.bundle = null
    this.downloading = false
    this.installing = false
  }

  setUpdate(update) { this.update = update }

  async checkForUpdates() {
    if (this.downloading || this.installing) return
    this.downloading = true
    try {
      if (!this.update || !this.update.url) throw new Error('Check for a macOS update before downloading')
      if (this.work) remove(this.work)
      this.work = fs.mkdtempSync(path.join(app.getPath('temp'), 'openvk-mac-update-'))
      this.bundle = null
      const archive = path.join(this.work, 'update.zip')
      this.emit('update-available')
      await this.download(this.update.url, archive)
      if (this.update.sha256) {
        if (!/^[a-f0-9]{64}$/i.test(this.update.sha256)) throw new Error('Invalid update SHA-256')
        const digest = await new Promise((resolve, reject) => {
          const hash = crypto.createHash('sha256')
          const stream = fs.createReadStream(archive)
          stream.on('data', chunk => hash.update(chunk))
          stream.on('error', reject)
          stream.on('end', () => resolve(hash.digest('hex')))
        })
        if (digest !== this.update.sha256.toLowerCase()) throw new Error('Update archive SHA-256 does not match')
      }
      validateArchive(archive)
      const extracted = path.join(this.work, 'extracted')
      fs.mkdirSync(extracted)
      await execute('/usr/bin/ditto', ['-x', '-k', archive, extracted])
      validateLinks(extracted)
      const bundles = findBundle(extracted)
      if (bundles.length !== 1) throw new Error('The update ZIP must contain exactly one application')
      await validateBundle(bundles[0], this.update.build)
      this.bundle = bundles[0]
      this.downloading = false
      this.emit('update-downloaded', this.update)
    } catch (error) {
      this.downloading = false
      this.bundle = null
      if (this.work) { remove(this.work); this.work = null }
      this.emit('error', error)
    }
  }

  download(url, destination, redirects = 0) {
    return new Promise((resolve, reject) => {
      const parsed = URL.parse(url)
      const localTest = this.options.allowHttp && parsed.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
      if (parsed.protocol !== 'https:' && !localTest) return reject(new Error('macOS updates require HTTPS'))
      const transport = localTest ? http : https
      const request = transport.get(Object.assign({}, parsed, {
        headers: { 'User-Agent': 'OpenVK-Messenger-Updater' }
      }), response => {
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
          response.resume()
          if (!response.headers.location || redirects >= 5) return reject(new Error('Too many update redirects'))
          return resolve(this.download(URL.resolve(url, response.headers.location), destination, redirects + 1))
        }
        if (response.statusCode !== 200) { response.resume(); return reject(new Error('Update download returned HTTP ' + response.statusCode)) }
        const file = fs.createWriteStream(destination, { flags: 'wx' })
        const total = Number(response.headers['content-length']) || 0
        let received = 0
        const fail = error => { response.destroy(); file.destroy(); reject(error) }
        file.on('error', fail)
        response.on('error', fail)
        response.on('aborted', () => fail(new Error('Update download was interrupted')))
        response.on('data', chunk => {
          received += chunk.length
          if (total) this.emit('download-progress', Math.min(received / total, 1))
        })
        file.on('finish', () => file.close(error => error ? reject(error) : resolve()))
        response.pipe(file)
      })
      request.setTimeout(30000, () => request.destroy(new Error('Update download timed out')))
      request.on('error', reject)
    })
  }

  async quitAndInstall() {
    if (this.installing) return
    this.installing = true
    let staged
    try {
      if (!this.bundle || !this.work) throw new Error('Download the update before installing')
      const current = this.options.appPath || path.dirname(path.dirname(path.dirname(process.execPath)))
      if (!current.endsWith('.app') || current.includes('/AppTranslocation/') || current.startsWith('/Volumes/')) {
        throw new Error('Move OpenVK Messenger to Applications before updating')
      }
      const parent = path.dirname(current)
      fs.accessSync(parent, fs.constants.W_OK)
      const suffix = crypto.randomBytes(8).toString('hex')
      staged = path.join(parent, '.openvk-update-' + suffix + '.app')
      const backup = path.join(parent, '.openvk-previous-' + suffix + '.app')
      await execute('/usr/bin/ditto', [this.bundle, staged])
      await validateBundle(staged, this.update.build)
      const helper = path.join(this.work, 'install.sh')
      fs.writeFileSync(helper, installScript, { mode: 0o700 })
      const logFile = path.join(app.getPath('userData'), 'mac-update-install.log')
      const args = []
      for (let index = 0; index < process.argv.length; index++) {
        const arg = process.argv[index]
        if (arg.startsWith('--user-data-dir=') || arg === '--disable-gpu') args.push(arg)
        else if (arg === '--user-data-dir' && process.argv[index + 1]) {
          args.push('--user-data-dir=' + process.argv[++index])
        }
      }
      const child = childProcess.spawn('/bin/sh', [helper, String(process.pid), current, staged,
        backup, logFile, this.work, this.options.launcher || '/usr/bin/open'].concat(args), {
        detached: true, stdio: 'ignore'
      })
      child.once('error', error => { this.installing = false; this.emit('error', error) })
      child.unref()
      setTimeout(() => { if (this.installing) app.quit() }, 200)
    } catch (error) {
      if (staged && fs.existsSync(staged)) remove(staged)
      this.installing = false
      this.emit('error', error)
    }
  }
}

module.exports = { MacUpdater, updater: new MacUpdater(), validateBundle, validateArchive, installScript }
