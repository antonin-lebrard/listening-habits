'use strict'

const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  // signal: new AbortController().signal,
})

let buf = ''


function doAsync(fn, cb) {
  fn((err) => {
    if (err) return cb();
    doAsync(fn, cb)
  })
}

let callback
rl.once('close', () => callback({err: 'qsfd'}))
doAsync((cb) => {
  callback = cb
  rl.question('', (line) => {
    buf += line
    cb()
  })
}, () => {
  console.log('\n\n\n\n\n')
  buf = buf.toString()
    .replace(/ +/g, " ")
    .replaceAll('\t\t\t', '\n')
    .replaceAll('\t', ' ')

  console.log(buf)
})
