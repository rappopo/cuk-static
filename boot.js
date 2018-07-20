'use strict'

const koaStatic = require('koa-static')
const favicon = require('koa-favicon')

module.exports = function(cuk){
  const pkgId = 'static'
  const { _, fs, path, helper, debug } = cuk.pkg.core.lib
  const { app, koaMount } = cuk.pkg.http.lib
  const pkg = cuk.pkg[pkgId]
  const staticAppDir = path.join(cuk.dir.app, 'cuks', pkgId, 'resource')

  fs.ensureDirSync(staticAppDir)

  const serve = (dir, options) => {
    return koaStatic(dir, helper('core:makeOptions')(pkgId, 'options', options))
  }

  pkg.lib.serve = serve

  const mountDir = function(kv, root, pid) {
    if (_.isEmpty(kv)) return
    _.forOwn(kv, (v, k) => {
      if (!path.isAbsolute(v)) {
        let _v = path.join(root, v)
        if (!fs.existsSync(_v))
          _v = path.join(cuk.dir.app, v)
        v = _v
      }
      if (!fs.existsSync(v)) return
      let mp = pkg.cfg.common.mount + (pid ? `${pid === '/' ? '':pid}` : '') + k
      if ((pkg.cfg.common.disabled || []).indexOf(mp) > -1) {
        helper('core:trace')(`|  |- Disabled => ${mp} -> ${helper('core:makeRelDir')(v, cuk.dir.app, 'ADIR:.')}`)
        return
      }
      app.use(koaMount(mp, serve(v)))
      helper('core:trace')(`|  |- Enabled => ${mp} -> ${helper('core:makeRelDir')(v, cuk.dir.app, 'ADIR:.')}`)
    })
  }

  return new Promise((resolve, reject) => {
    let faviconDef = path.join(pkg.dir, 'cuks', pkgId, 'resource', 'favicon.ico'),
      faviconFile = path.join(staticAppDir, 'favicon.ico')
    if (!fs.existsSync(faviconFile)) faviconFile = faviconDef
    app.use(favicon(faviconFile))
    helper('core:trace')(`|  |- Enabled => favicon.ico -> %s ${helper('core:makeRelDir')(faviconFile)}`)
    _.forOwn(cuk.pkg, (v, k) => {
      let dir = path.join(v.dir, 'cuks', pkgId, 'resource'),
        mp = `${pkg.cfg.common.mount}${v.cfg.common.mount === '/' ? '' : ('/' + v.id)}`
      if (!fs.existsSync(dir)) return
      if ((pkg.cfg.common.disabled || []).indexOf(mp) > -1) {
        helper('core:trace')(`|  |- Disabled => ${mp} -> ${helper('core:makeRelDir')(dir, cuk.dir.app, 'ADIR:.')}`)
        return
      }
      if (mp === pkg.cfg.common.mount) {
        let mws = [helper('http:composeMiddleware')(_.get(pkg.cfg, 'cuks.http.middleware', []), `${pkg.id}:*`)]
        mws.push(serve(dir))
        app.use(koaMount(mp, cuk.pkg.http.lib.koaCompose(mws)))
      } else {
        app.use(koaMount(mp, serve(dir)))
      }
      helper('core:trace')(`|  |- Enabled => ${mp} -> ${helper('core:makeRelDir')(dir, cuk.dir.app, 'ADIR:.')}`)
    })
    Promise.map(helper('core:pkgs')(), function(p) {
      return new Promise((resv, rejc) => {
        let dir = path.join(p.dir, 'cuks', pkgId)
        helper('core:configLoad')(dir, 'resource')
        .then(result => {
          mountDir(result, p.dir, '/' + p.id)
          resv(true)
        })
      })
    })
    .then(resolve)
    .catch(reject)
  })

}