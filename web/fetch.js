'use strict'

function get(url, cb) {
  let xhttp = new XMLHttpRequest()
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState === 4 && xhttp.status === 200) {
      cb(xhttp.responseText);
    }
  }
  xhttp.open("GET", url, true)
  xhttp.send()
}

const u = 'http://localhost:5000'

function fetchArtistsHabits(cb) {
  get(u, (body) => {
    const tracksByArtists = JSON.parse(body)
    cb(tracksByArtists)
  })
}