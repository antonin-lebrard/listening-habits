'use strict'

Array.prototype.last = function() {
  return this[this.length - 1]
}
Array.prototype.first = function() {
  return this[0]
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