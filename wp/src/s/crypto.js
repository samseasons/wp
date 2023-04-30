function rotate(a, b) {
  return (a << b) | (a >>> (32 - b))
}

function quarter(x, a, b, c, d) {
  x[a] += x[b]
  x[d] = rotate(x[d] ^ x[a], 16)
  x[c] += x[d]
  x[b] = rotate(x[b] ^ x[c], 12)
  x[a] += x[b]
  x[d] = rotate(x[d] ^ x[a], 8)
  x[c] += x[d]
  x[b] = rotate(x[b] ^ x[c], 7)
  x[a] >>>= 0
  x[b] >>>= 0
  x[c] >>>= 0
  x[d] >>>= 0
}

function quarters(x) {
  quarter(x, 0, 4, 8, 12)
  quarter(x, 1, 5, 9, 13)
  quarter(x, 2, 6, 10, 14)
  quarter(x, 3, 7, 11, 15)
  quarter(x, 0, 5, 10, 15)
  quarter(x, 1, 6, 11, 12)
  quarter(x, 2, 7, 8, 13)
  quarter(x, 3, 4, 9, 14)
}

function unpack(len, data) {
  const xs = []
  for (let i = 0; i < len; i++) {
    const x = data.slice(i*4, (i+1)*4)
    xs.push((x[0] ^ (x[1] << 8) ^ (x[2] << 16) ^ (x[3] << 24)) >>> 0)
  }
  return xs
}

function state(key) {
  const xs = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]
  xs.push(...unpack(8, key.slice(0, 32)))
  return xs
}

function hchacha(key, nonce, rounds) {
  const x = state(key)
  x.push(...unpack(4, nonce.slice(0, 16)))
  for (let i = 0; i < rounds / 2; i++) {
      quarters(x)
  }
  let y = []
  for (let i = 0, j = 0; i < 16; i++) {
    if (i === 4) i = 12
    y[j++] = x[i] & 0xff
    y[j++] = (x[i] >>> 8) & 0xff
    y[j++] = (x[i] >>> 16) & 0xff
    y[j++] = (x[i] >>> 24) & 0xff
  }
  return y
}

function chacha(key, nonce, rounds) {
  const xs = state(key)
  xs.push(0, ...unpack(3, nonce.slice(0, 12)))
  const x = xs.slice()
  for (let i = 0; i < rounds / 2; i++) {
    quarters(x)
  }
  let y = []
  for (let i = 0, j = 0; i < 16; i++) {
    x[i] += xs[i]
    y[j++] = x[i] & 0xff
    y[j++] = (x[i] >>> 8) & 0xff
    y[j++] = (x[i] >>> 16) & 0xff
    y[j++] = (x[i] >>> 24) & 0xff
  }
  return y
}

export function decrypt(data, key, rounds=20) {
  key = key.slice(0, 32)
  const nonce = data.slice(0, 24)
  const subkey = hchacha(key, nonce.slice(0, 16), rounds)
  const subnonce = [...[0, 0, 0, 0], ...nonce.slice(16)]
  const cha = chacha(subkey, subnonce, rounds)
  const decrypted = []
  data.slice(24).map(function(e, i) {decrypted.push(e ^ cha[i])})
  return decrypted
}

export function encrypt(data, key, nonce=null, rounds=20) {
  key = key.slice(0, 32)
  nonce = nonce || crypto.getRandomValues(new Uint8Array(24))
  const subkey = hchacha(key, nonce.slice(0, 16), rounds)
  const subnonce = [...[0, 0, 0, 0], ...nonce.slice(16)]
  const cha = chacha(subkey, subnonce, rounds)
  const encrypted = []
  data.map(function(e, i) {encrypted.push(e ^ cha[i])})
  return [...nonce, ...encrypted]
}