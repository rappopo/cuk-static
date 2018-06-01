'use strict'

const koaStatic = require('koa-static')
const favicon = require('koa-favicon')

module.exports = function(cuk){
  const pkgId = 'static'
  const { _, fs, path, helper, debug } = cuk.lib
  const { app, mount } = cuk.pkg.http.lib
  const pkg = cuk.pkg[pkgId]
  const staticRootDir = path.join(cuk.dir.root, 'cuks', pkgId)

  const serve = function(dir, options) {
    return koaStatic(dir, helper.makeOptions(pkgId, 'options', options))
  }

  pkg.trace('Initializing...')
  pkg.lib = {
    serve: serve
  }

  const mountDir = function(kv, root, pid) {
    if (_.isEmpty(kv)) return
    _.forOwn(kv, (v, k) => {
      if (!path.isAbsolute(v)) {
        let _v = path.join(root, v)
        if (!fs.existsSync(_v))
          _v = path.join(cuk.dir.root, v)
        v = _v
      }
      if (!fs.existsSync(v)) return
      let mp = pkg.cfg.mountStatic + (pid ? `${pid === '/' ? '':pid}` : '') + k
      if ((pkg.cfg.disabled || []).indexOf(mp) > -1) {
        pkg.trace(`Disabled » ${mp} -> ${helper.makeRelDir(v, cuk.dir.root)}`)
        return
      }
      app.use(mount(mp, serve(v)))

      pkg.trace(`Enabled » ${mp} -> ${helper.makeRelDir(v, cuk.dir.root)}`)
    })
  }

  return new Promise((resolve, reject) => {
    let faviconDef = path.join(pkg.dir, 'cuks', pkgId, 'favicon.ico'),
      faviconFile = path.join(staticRootDir, 'favicon.ico')
    if (!fs.existsSync(faviconFile)) faviconFile = faviconDef
    app.use(favicon(faviconFile))
    pkg.trace(`Serve » favicon.ico -> %s`, helper.makeRelDir(faviconFile))
    _.forOwn(cuk.pkg, (v, k) => {
      let dir = path.join(v.dir, 'cuks', pkgId),
        mp = `${pkg.cfg.mountStatic}${v.cfg.mount === '/' ? '' : v.cfg.mount}`
      if (!fs.existsSync(dir)) return
      if ((pkg.cfg.disabled || []).indexOf(mp) > -1) {
        pkg.trace(`Disabled » ${mp} -> ${helper.makeRelDir(dir)}`)
        return
      }
      app.use(mount(mp, serve(dir)))
      pkg.trace(`Enabled » ${mp} -> ${helper.makeRelDir(dir)}`)
    })
    Promise.map(helper.getPkgs(), function(p) {
      return new Promise((resv, rejc) => {
        let dir = path.join(p.dir, 'cuks')
        helper.makeConfig(dir, pkgId)
        .then(result => {
          mountDir(result, p.dir, p.cfg.mount)
          resv(true)
        })
      })
    })
    .then(resolve)
    .catch(reject)
  })

}