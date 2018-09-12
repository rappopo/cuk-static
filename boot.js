'use strict'

const koaStatic = require('koa-static')
const favicon = require('koa-favicon')

module.exports = function (cuk) {
  const pkgId = 'static'
  const { _, fs, path, helper } = cuk.pkg.core.lib
  const { app, koaMount } = cuk.pkg.http.lib
  const pkg = cuk.pkg[pkgId]
  const staticAppDir = path.join(cuk.dir.app, 'cuks', pkgId, 'public')

  fs.ensureDirSync(staticAppDir)

  const serve = (dir, options) => {
    return koaStatic(dir, helper('core:makeOptions')(pkgId, 'options', options))
  }

  pkg.lib.serve = serve

  const mountDir = (kv, root, p) => {
    if (_.isEmpty(kv)) return
    _.forOwn(kv, (v, k) => {
      let item = _.isString(v) ? { dir: v } : v
      if (!item.middleware) item.middleware = []
      const tag = item.dir.substr(0, 5)
      if (['adir:', 'ddir:', 'pdir:'].indexOf(tag) > -1) {
        item.dir = item.dir.substr(5)
        if (item.dir.substr(0, 1) !== '/') item.dir = '/' + item.dir
        switch (tag) {
          case 'adir:': item.dir = path.join(cuk.dir.app, item.dir); break
          case 'ddir:': item.dir = path.join(cuk.dir.data, item.dir); break
          case 'pdir:': item.dir = path.join(p.dir, item.dir); break
        }
      }
      if (!path.isAbsolute(item.dir)) {
        let _v = path.join(root, item.dir)
        if (!fs.existsSync(_v)) _v = path.join(cuk.dir.app, item.dir)
        item.dir = _v
      }
      if (!fs.existsSync(item.dir)) return
      let mp = pkg.cfg.common.mount
      if (p.id !== 'app') mp += '/' + p.id
      if (k.substr(0, 1) !== '/') k = '/' + k
      mp += k
      if ((pkg.cfg.common.disabled || []).indexOf(mp) > -1) {
        helper('core:trace')(`|  |- Disabled => ${mp} -> ${helper('core:makeRelDir')(item.dir, cuk.dir.app, 'ADIR:.')}`)
        return
      }
      if (!_.isEmpty(item.middleware)) {
        const mws = [helper('http:composeMiddleware')(item.middleware)]
        mws.push(serve(item.dir))
        app.use(koaMount(mp, cuk.pkg.http.lib.koaCompose(mws)))
      } else {
        app.use(koaMount(mp, serve(item.dir)))
      }
      helper('core:trace')(`|  |- Enabled => ${mp} -> ${helper('core:makeRelDir')(item.dir, cuk.dir.app, 'ADIR:.')}`)
    })
  }

  const doMount = (p) => {
    return new Promise((resolve, reject) => {
      const dir = path.join(p.dir, 'cuks', pkgId)
      let src = {}
      helper('core:configLoad')(dir, 'resource')
        .then(result => {
          if (_.isEmpty(result)) return {}
          src = result
          return helper('core:configExtend')(p.id, 'static', 'resource')
        })
        .then(result => {
          if (!_.isEmpty(src)) {
            src = _.merge(src, result)
            if (fs.existsSync(path.join(p.dir, 'cuks', 'static', 'public'))) {
              src[''] = 'pdir:/cuks/static/public'
            }
            mountDir(src, p.dir, p)
          }
          resolve(true)
        })
        .catch(reject)
    })
  }

  return new Promise((resolve, reject) => {
    // favicon
    const faviconDef = path.join(pkg.dir, 'cuks', 'static', 'favicon.ico')
    let faviconFile = path.join(staticAppDir, 'favicon.ico')
    if (!fs.existsSync(faviconFile)) faviconFile = faviconDef
    app.use(favicon(faviconFile))
    helper('core:trace')(`|  |- Enabled => favicon.ico -> %s ${helper('core:makeRelDir')(faviconFile)}`)
    // resource files
    Promise.map(helper('core:pkgs')(), function (p) {
      return doMount(p)
    })
      .then(resolve)
      .catch(reject)
  })
}
