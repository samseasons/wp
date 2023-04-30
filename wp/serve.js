import fs from 'fs'
import http from 'http'
import path from 'path'

const args = process.argv

const stat = args.length > 2 ? args[2] : 'm'
const port = args.length > 3 ? args[3] : 2345
const html = args.length > 4 ? args[4] : 'x.html'

const prepareFile = async (url) => {
  url = '/' + url.split('/').pop()
  const paths = [stat, url]
  if (url.endsWith('/')) paths.push(html)
  const filePath = path.join(...paths)
  const exists = await fs.promises.access(filePath).then(() => true, () => false)
  const found = filePath.startsWith(stat) && exists
  const streamPath = found ? filePath : stat + '/' + html
  const ext = path.extname(streamPath).substring(1).toLowerCase()
  const stream = fs.createReadStream(streamPath)
  return {found, ext, stream}
}

http.createServer(async (req, res) => {
  const file = await prepareFile(req.url)
  file.stream.pipe(res)
}).listen(port)