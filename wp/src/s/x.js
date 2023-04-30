import { router, stream } from './route'

const streamUrls = ['https://127.0.0.1:4123/']

function startStreams(startUrls=null) {
  const streams = []
  if (startUrls) {
    startUrls.map(sUrl => streams.push(stream(sUrl)))
  } else {
    streamUrls.map(sUrl => streams.push(stream(sUrl)))
  }
  return streams
}

function getRoute() {
  const path = document.location.pathname
  const route = path.split('/')[1]
  const subroute = path.split('/')[2]
  if (route === 'u') {
    return router(route, subroute)
  } else {
    return null
  }
}

function run() {
  const end = document.getElementById('end')
  const route = getRoute()
  if (route) {
    document.body.insertBefore(route, end)
  }
  const streams = startStreams(streamUrls)
}

document.body.onload = run()