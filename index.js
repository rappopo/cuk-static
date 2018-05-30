'use strict'

module.exports = function(cuk) {
  const { path } = cuk.lib
  return Promise.resolve({
    id: 'static',
    tag: 'boot',
    level: 3
  })
}