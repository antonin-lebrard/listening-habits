'use strict'

const util = require('util')
const _ = require('lodash')

const c = require('./colors')
require('./polyfills')

/**
 * @param {Object} objArtistNbTrack
 * @param {String} objArtistNbTrack.artist
 * @param {Number} objArtistNbTrack.tracksListened
 * @param {String} month
 * @param {Object.<String, String>} artistToMonth
 * @param {Number} lastMonth
 * @param {Object.<String, Number>} artistTotalListen
 * @param {Object} storagePredictions
 * @param {Object.<String, Function>} storagePredictions.surely
 * @param {Object.<String, Function>} storagePredictions.maybe
 * @param {Object.<String, Function>} storagePredictions.not
 * @param {Object.<String, Function>} storagePredictions.unknown
 * @return {String}
 */
function inColor(objArtistNbTrack, month, artistToMonth, lastMonth, artistTotalListen, storagePredictions) {
  const monthsAppearsInto = artistToMonth[objArtistNbTrack.artist]
  const haveBefore = monthsAppearsInto.length > 0 ? monthsAppearsInto.first() < month : false
  const haveAfter = monthsAppearsInto.length > 0 ? monthsAppearsInto.last() > month : false

  /**
   * @type {Function}
   */
  let colorFn = c.white
  if (haveBefore && haveAfter) {
    colorFn = c.cyan
  } else if (haveBefore) {
    if ((lastMonth - parseInt(month)) < 3) {
      colorFn = c.yellow
      if (monthsAppearsInto.length > 2) {
        colorFn = c.green
      }
    } else {
      colorFn = c.red
      if (monthsAppearsInto.length > 2) {
        colorFn = c.redBright
      }
    }
  } else if (haveAfter) {
    colorFn = c.green
    if (monthsAppearsInto.length > 2) {
      colorFn = c.greenBright
    }
  }

  if (monthsAppearsInto.length > 5 && artistTotalListen[objArtistNbTrack.artist] > 300)
    colorFn = c.magentaBright

  const name = objArtistNbTrack.artist

  switch (colorFn) {
    case c.red:
    case c.green:
      storagePredictions.maybe[name] = c.red
      break
    case c.white:
      storagePredictions.not[name] = c.white
      break
    case c.yellow:
      storagePredictions.unknown[name] = c.yellow
      break
    case c.cyan:
    case c.redBright:
    case c.greenBright:
      storagePredictions.surely[name] = c.cyan
      break
    case c.magentaBright:
      storagePredictions.surely[name] = c.magentaBright
      break
  }

  return colorFn(
    objArtistNbTrack.artist.complete(50)
    + ': '
    + objArtistNbTrack.tracksListened.toString().complete(5)
    + ' total: '
    + artistTotalListen[objArtistNbTrack.artist]
  )
}

/**
 * @param {Object} objArtistNbTrack
 * @param {String} objArtistNbTrack.artist
 * @param {Number} objArtistNbTrack.tracksListened
 * @param {String} month
 * @param {Object.<String, String>} artistToMonth
 * @param {Number} lastMonth
 * @return {String}
 */
function inColorEvolution(objArtistNbTrack, month, artistToMonth, lastMonth) {
  const monthsAppearsInto = artistToMonth[objArtistNbTrack.artist]
  const haveBefore = monthsAppearsInto.length > 0 ? monthsAppearsInto.first() < month : false
  const haveAfter = monthsAppearsInto.length > 0 ? monthsAppearsInto.last() > month : false
  const justBefore = haveBefore && monthsAppearsInto.have(m => parseInt(m) === parseInt(month) - 1)
  const justAfter = haveAfter && monthsAppearsInto.have(m => parseInt(m) === parseInt(month) + 1)

  /**
   * @type {Function}
   */
  let colorFn = c.white
  if (justBefore && justAfter) {
    colorFn = c.magentaBright
  } else if (justBefore) {
    if ((lastMonth - parseInt(month)) < 2) {
      colorFn = c.yellow
    } else {
      colorFn = c.red
      if (monthsAppearsInto.length > 2) {
        colorFn = c.redBright
      }
    }
  } else if (haveAfter) {
    colorFn = c.green
    if (monthsAppearsInto.length > 2) {
      colorFn = c.greenBright
    }
  }

  return colorFn(
    objArtistNbTrack.artist.complete(50)
    + ': '
    + objArtistNbTrack.tracksListened.toString().complete(5)
  )
}

module.exports = {

  /**
   * @param {Object.<Number, Object>}topByMonth
   */
  printTopByMonth(topByMonth) {
    console.log('')

    const artistToMonth = {}
    const artistTotalListen = {}
    const oneMonth = 30 * 24 * 60 * 60

    const lastMonth = parseInt(Object.keys(topByMonth).last())

    Object.keys(topByMonth).forEach(m => {
      topByMonth[m].forEach(el => {
        if (artistToMonth[el.artist] === undefined) {
          artistToMonth[el.artist] = []
          artistTotalListen[el.artist] = 0
        }
        artistToMonth[el.artist].push(m)
        artistTotalListen[el.artist] += el.tracksListened
      })
    })

    const predictions = {
      not:     {},
      maybe:   {},
      unknown: {},
      surely:  {},
    }

    Object.keys(topByMonth).forEach(m => {
      if (parseInt(m) === 0) return

      const d1 = new Date(parseInt(m) * oneMonth * 1000).toLocaleDateString()
      const d2 = new Date((parseInt(m)+1) * oneMonth * 1000).toLocaleDateString()

      console.log(d1, '-', d2)
      console.log('')

      topByMonth[m]
        .forEach(el => console.log(inColor(el, m, artistToMonth, lastMonth, artistTotalListen, predictions)))
      console.log('')
    })

    Object.keys(predictions).forEach(k => {
      console.log('')
      console.log(k)
      console.log('')
      Object.keys(predictions[k]).forEach(artist => {
        console.log(predictions[k][artist](artist))
      })
    })

  },

  /**
   * @param {Object.<Number, Object>}topByMonth
   */
  printEvolutionTopByMonth(topByMonth) {
    console.log('')

    const artistToMonth = {}
    const oneMonth = 30 * 24 * 60 * 60

    const lastMonth = parseInt(Object.keys(topByMonth).last())

    Object.keys(topByMonth).forEach(m => {
      topByMonth[m].slice(0,25).forEach(el => {
        if (artistToMonth[el.artist] === undefined) {
          artistToMonth[el.artist] = []
        }
        artistToMonth[el.artist].push(m)
      })
    })

    Object.keys(topByMonth).forEach(m => {
      if (parseInt(m) === 0) return

      const d1 = new Date(parseInt(m) * oneMonth * 1000).toLocaleDateString()
      const d2 = new Date((parseInt(m)+1) * oneMonth * 1000).toLocaleDateString()

      console.log(d1, '-', d2)
      console.log('')

      topByMonth[m]
        .slice(0, 25)
        .forEach(el => console.log(inColorEvolution(el, m, artistToMonth, lastMonth)))
      console.log('')
    })

  },

  drawChoices(res, track) {

    function artistCountry(artist) {
      if (artist.country) {
        return `\n  country: '${c.green(`'${artist.country}'`)}',`
      }
      return ''
    }

    function extraProperties(obj, spaces, omit) {
      let copy = JSON.parse(JSON.stringify(obj))
      omit.forEach(prop => {
        if (prop.includes('[].')) {
          copy[prop.substring(0, prop.indexOf('[].'))].forEach(el => {
            _.unset(el, prop.substring(prop.indexOf('[].') + 3))
          })
        } else {
          _.unset(copy, prop)
        }
      })
      let objS = util.inspect(copy, { depth: Infinity, maxArrayLength: Infinity })
      objS = objS.substring(2, objS.length - 2)
      objS.replaceAll('\n', '\n'.complete(spaces + 1))
      return objS
    }

    console.log('\n\n\n')
    console.log('track json')
    console.log(
`{
  artist: { mbid: '${track.artist.mbid}', '#text': ${c.greenBright(`'${track.artist['#text']}'`)} },
  mbid: '${track.mbid}',
  album: { mbid: '${track.album.mbid}', '#text': ${c.greenBright(`'${track.album['#text']}'`)} },
  name: ${c.greenBright(`'${track.name}'`)},
  url: '${track.url}',
  date: { uts: '${track.date.uts}', '#text': '${track.date['#text']}' }
}`)

    if (res.artists !== undefined) { /// ARTISTS

      console.log('artists results, length: ' + res.artists.length)
      res.artists.forEach((artist, i) => {
        console.log(i + ')')
        console.log(
`{
  id: '${artist.id}',
  type: '${artist.type}',
  score: ${artist.score},
  name: ${c.greenBright(`'${artist.name}'`)},${artistCountry(artist)}
${extraProperties(artist, 0, ['id', 'type', 'type-id', 'score', 'name', 'gender-id', 'ipis', 'isnis'])}
}`)
      })
      console.log(res.artists.length + ') manual entry')
      console.log((res.artists.length + 1) + ') none of these')

    } else if (res.releases !== undefined) { /// RELEASES

      console.log('releases results, length: ' + res.releases.length)
      res.releases.forEach((release, i) => {
        console.log(i + ')')
        console.log(
          `{
  id: '${release.id}',
  score: ${release.score},
  title: ${c.greenBright(`'${release.title}'`)},
${extraProperties(release, 0, 
['id', 'score', 'status-id', 'packaging-id', 'count', 'title', 'packaging', 'text-representation', 
  'release-group.id', 
  'release-group.type-id', 
  'release-group.primary-type-id', 
  'release-group.secondary-type-ids', 
  'country',
  'release-events', 
  'barcode',
  'label-info[].label.id'])}
}`)
      })
      console.log(res.releases.length + ') manual entry')
      console.log((res.releases.length + 1) + ') none of these')

    } else if (res.recordings !== undefined) { /// RECORDINGS

      console.log('recordings results, length: ' + res.recordings.length)
      res.recordings.forEach((recording, i) => {
        console.log(i + ')')
        console.log(
          `{
  id: '${recording.id}',
  score: ${recording.score},
  title: ${c.greenBright(`'${recording.title}'`)},
${extraProperties(recording, 0,
['id', 'score', 'title', 'video', 'isrcs',
  'artist-credit[].artist.aliases',
  'releases[].id',
  'releases[].status-id',
  'releases[].packaging-id',
  'releases[].count',
  'releases[].status',
  'releases[].packaging',
  'releases[].text-representation',
  'releases[].release-group.id',
  'releases[].release-group.type-id',
  'releases[].release-group.primary-type-id',
  'releases[].release-group.secondary-type-ids',
  'releases[].country',
  'releases[].release-events',
  'releases[].barcode'])}
}`)
      })
      console.log(res.recordings.length + ') manual entry')
      console.log((res.recordings.length + 1) + ') none of these')

    }
  },


}


