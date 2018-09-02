'use strict'

module.exports = function (cuk) {
  const { path } = cuk.pkg.core.lib
  return Promise.resolve({
    id: 'static',
    level: 15
  })
}