'use strict'

Array.prototype.last = function() {
  return this[this.length - 1]
}
Array.prototype.first = function() {
  return this[0]
}
Array.prototype.mean = function(getValueFn) {
  return this.reduce((total, el) => total + getValueFn(el), 0) / this.length
}
Array.prototype.median = function(getValueFn) {
  this.sort((a, b) => getValueFn(b) - getValueFn(a))
  if (this.length % 2 === 1) {
    return (
      getValueFn(this[Math.floor(this.length / 2)])
      + getValueFn(this[Math.ceil(this.length / 2)]))
      / 2
  } else {
    return getValueFn(this[Math.round(this.length / 2)])
  }
}
Array.prototype.removeLastEmpty = function() {
  if (!this[this.length - 1] || this[this.length - 1] === '') {
    this.pop()
  }
  return this
}
Array.prototype.have = function(predicate) {
  for (let i = 0; i < this.length; i++) {
    if (predicate(this[i], i, this)) {
      return true
    }
  }
  return false
}

String.prototype.isContainedIn = function(other) {
  let isContained = false
  for (let i = 0; i < other.length; i++) {
    if (this.charAt(0) === other.charAt(i)) {
      isContained = true
      for (let j = 1; j < this.length; j++) {
        if (this.charAt(j) !== other.charAt(i + j)) {
          isContained = false
          break
        }
      }
      if (isContained) return true
    }
  }
  return isContained
}
String.prototype.bw = function(char) {
  return this.length > 0 && this[0] === char
}
String.prototype.bwl = function(listChars) {
  if (this.length === 0) return false
  for (const c in listChars) {
    if (this[0] === c) return true
  }
  return false
}
String.prototype.ew = function(char) {
  return this.length > 0 && this[this.length - 1] === char
}
String.prototype.ewl = function(listChars) {
  if (this.length === 0) return false
  for (const c in listChars) {
    if (this[this.length - 1] === c) return true
  }
  return false
}
String.prototype.ss = function(nbChars) {
  return this.substring(nbChars, this.length)
}
String.prototype.rs = function(nbChars) {
  return this.substring(0, this.length - nbChars)
}
String.prototype.complete = function(toNb) {
  let diff = toNb - this.length
  for (let i = 0; i < this.length; i++) {
    if (this.charCodeAt(i) > 8194) diff--
    if (this.charCodeAt(i) > 767 && this.charCodeAt(i) < 880) diff++
  }
  let s = ''
  for (let i = 0; i < diff; i++) {
    s += ' '
  }
  return this + s
}
