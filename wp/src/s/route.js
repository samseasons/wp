import { decrypt, encrypt } from './crypto'

const chars64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function randStr(len=32) {
  let id = ''
  crypto.getRandomValues(new Uint8Array(len)).forEach(rand => {
    id += chars64.charAt(rand / 4)
  })
  return id
}

function send(url, data='') {
  fetch(url, {method:'post', mode:'cors', headers:{'content-type':'text/plain'}, body:data})
}

export function stream(url) {
  const aKey = randStr()
  const events = new EventSource(url + '1/' + aKey + '/')
  const main = document.getElementById('main')
  const div = document.createElement('div')
  div.id = 'data'
  document.body.insertBefore(div, main)
  events.onmessage = function (event) {
    div.innerHTML = event.data
  }
  events.onjoin = function (event) {
  }
  events.onerror = function (event) {
    events.close()
  }
  return events
}

export function router(route, sub) {
  if (route === 'u') {
    const main = document.createElement('div')
    main.className = 'main'
    main.id = 'main'
    main.innerHTML = `<div class='sub'>whats up ${sub}</div>`
    return main
  } else {
    return null
  }
}