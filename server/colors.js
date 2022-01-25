'use strict'

const bc = '\u001b['
const ec = 'm'
const resetC = `${bc}39;49${ec}`

function blackBright(str) {   return `${bc}90;47${ec}${str}${resetC}` }
function black(str) {         return `${bc}30;47${ec}${str}${resetC}` }
function redBright(str) {     return `${bc}91;40${ec}${str}${resetC}` }
function red(str) {           return `${bc}31;40${ec}${str}${resetC}` }
function greenBright(str) {   return `${bc}92;40${ec}${str}${resetC}` }
function green(str) {         return `${bc}32;40${ec}${str}${resetC}` }
function yellowBright(str) {  return `${bc}93;40${ec}${str}${resetC}` }
function yellow(str) {        return `${bc}33;40${ec}${str}${resetC}` }
function blueBright(str) {    return `${bc}94;40${ec}${str}${resetC}` }
function blue(str) {          return `${bc}34;40${ec}${str}${resetC}` }
function magentaBright(str) { return `${bc}95;40${ec}${str}${resetC}` }
function magenta(str) {       return `${bc}35;40${ec}${str}${resetC}` }
function cyanBright(str) {    return `${bc}96;40${ec}${str}${resetC}` }
function cyan(str) {          return `${bc}36;40${ec}${str}${resetC}` }
function whiteBright(str) {   return `${bc}97;40${ec}${str}${resetC}` }
function white(str) {         return `${bc}37;40${ec}${str}${resetC}` }

const colors = [
  greenBright,
  green,
  blueBright,
  blue,
  whiteBright,
  white,
  cyan,
  yellow,
  yellowBright,
  redBright,
  red,
]

module.exports = {
  colors,
  blackBright,
  black,
  redBright,
  red,
  greenBright,
  green,
  yellowBright,
  yellow,
  blueBright,
  blue,
  magentaBright,
  magenta,
  cyanBright,
  cyan,
  whiteBright,
  white,
}
