'use strict'


module.exports = {

  getStructure: function getStructure(obj) {
    const struct = {}
    const keys = Object.keys(obj)
    keys.forEach(key => {
      const type = typeof obj[key]
      if (type === 'string' || type === 'number' || type === 'boolean' || type === 'undefined')
        struct[key] = type
      else {
        struct[key] = getStructure(obj[key])
      }
    })
    return struct
  },

  mergeObjs: function mergeObjs(into, from) {
    const inKeys = Object.keys(into)
    const fromKeys = Object.keys(from)
    const concatKeys = inKeys.concat(fromKeys)
    for (const key of concatKeys) {
      if (into[key] === undefined) {
        into[key] = from[key]
      } else if (typeof into[key] === 'object' && typeof from[key] === 'object') {
        into[key] = mergeObjs(into[key], from[key])
      }
    }
    return into
  }

}