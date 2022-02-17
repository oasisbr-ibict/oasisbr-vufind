/* global userIsLoggedIn, VuFind */
VuFind.register('account', function Account () {
  // Retrieved statuses
  const LOADING = -1 * Math.PI // waiting for request
  const MISSING = -2 * Math.PI // no data available
  const INACTIVE = -3 * Math.PI // status element missing
  const _statuses = {}
  const _pendingNotifications = {}

  // Account Icons
  const ICON_LEVELS = {
    NONE: 0,
    GOOD: 1,
    WARNING: 2,
    DANGER: 3
  }
  const _accountIcons = {}
  _accountIcons[ICON_LEVELS.NONE] = 'fa fa-user-circle'
  _accountIcons[ICON_LEVELS.GOOD] = 'fa fa-bell text-success'
  _accountIcons[ICON_LEVELS.WARNING] = 'fa fa-bell text-warning'
  _accountIcons[ICON_LEVELS.DANGER] = 'fa fa-exclamation-triangle text-danger'

  const _submodules = []

  const _sessionDataPrefix = 'vf-account-status-'
  const _save = function _save (module) {
    sessionStorage.setItem(
      _sessionDataPrefix + module,
      JSON.stringify(_statuses[module])
    )
  }

  // Clearing save forces AJAX update next page load
  const clearCache = function clearCache (name) {
    if (typeof name === 'undefined' || name === '') {
      for (const sub in _submodules) {
        if (Object.prototype.hasOwnProperty.call(_submodules, sub)) {
          clearCache(sub)
        }
      }
    } else {
      sessionStorage.removeItem(_sessionDataPrefix + name)
    }
  }

  const _getStatus = function _getStatus (module) {
    return (typeof _statuses[module] === 'undefined') ? LOADING : _statuses[module]
  }

  const _render = function _render () {
    let accountStatus = ICON_LEVELS.NONE
    for (const sub in _submodules) {
      if (Object.prototype.hasOwnProperty.call(_submodules, sub)) {
        const status = _getStatus(sub)
        if (status === INACTIVE) {
          continue
        }
        const $element = $(_submodules[sub].selector)
        if ($element.length === 0) {
          // This could happen if the DOM is changed dynamically
          _statuses[sub] = INACTIVE
          continue
        }
        if (status === MISSING) {
          $element.addClass('hidden')
        } else {
          $element.removeClass('hidden')
          if (status === LOADING) {
            $element.html('<i class="fa fa-spin fa-spinner"></i>')
          } else {
            const moduleStatus = _submodules[sub].render($element, _statuses[sub], ICON_LEVELS)
            if (moduleStatus > accountStatus) {
              accountStatus = moduleStatus
            }
          }
        }
      }
    }
    $('#account-icon').attr('class', _accountIcons[accountStatus])
    if (accountStatus > ICON_LEVELS.NONE) {
      $('#account-icon')
        .attr('data-toggle', 'tooltip')
        .attr('data-placement', 'bottom')
        .attr('title', VuFind.translate('account_has_alerts'))
        .tooltip()
    } else {
      $('#account-icon').tooltip('destroy')
    }
  }
  const _ajaxLookup = function _ajaxLookup (module) {
    $.ajax({
      url: VuFind.path + '/AJAX/JSON?method=' + _submodules[module].ajaxMethod,
      dataType: 'json'
    })
      .done(function ajaxLookupDone (response) {
        _statuses[module] = response.data
      })
      .fail(function ajaxLookupFail () {
        _statuses[module] = MISSING
      })
      .always(function ajaxLookupAlways () {
        _save(module)
        _render()
      })
  }

  const _load = function _load (module) {
    const $element = $(_submodules[module].selector)
    if (!$element) {
      _statuses[module] = INACTIVE
    } else {
      const json = sessionStorage.getItem(_sessionDataPrefix + module)
      const session = typeof json === 'undefined' ? null : JSON.parse(json)
      if (
        session === null ||
        session === LOADING ||
        session === MISSING
      ) {
        _statuses[module] = LOADING
        _ajaxLookup(module)
      } else {
        _statuses[module] = session
      }
      _render()
    }
  }

  const notify = function notify (module, status) {
    if (Object.prototype.hasOwnProperty.call(_submodules, module) && typeof _submodules[module].updateNeeded !== 'undefined') {
      if (_submodules[module].updateNeeded(_getStatus(module), status)) {
        clearCache(module)
        _load(module)
      }
    } else {
      // We currently support only a single pending notification for each module
      _pendingNotifications[module] = status
    }
  }

  const init = function init () {
    // Update information when certain actions are performed
    $('form[data-clear-account-cache]').submit(function dataClearCacheForm () {
      clearCache($(this).attr('data-clear-account-cache'))
    })
    $('a[data-clear-account-cache]').click(function dataClearCacheLink () {
      clearCache($(this).attr('data-clear-account-cache'))
    })
    $('select[data-clear-account-cache]').change(function dataClearCacheSelect () {
      clearCache($(this).attr('data-clear-account-cache'))
    })
  }

  const register = function register (name, module) {
    if (typeof _submodules[name] === 'undefined') {
      _submodules[name] = typeof module === 'function' ? module() : module
    }
    const $el = $(_submodules[name].selector)
    if ($el.length > 0) {
      $el.removeClass('hidden')
      _statuses[name] = LOADING
      _load(name)
    } else {
      _statuses[name] = INACTIVE
    }
    if (typeof _pendingNotifications[name] !== 'undefined' && _pendingNotifications[name] !== null) {
      const status = _pendingNotifications[name]
      _pendingNotifications[name] = null
      notify(name, status)
    }
  }

  return {
    init: init,
    clearCache: clearCache,
    notify: notify,
    // if user is logged out, clear cache instead of register
    register: userIsLoggedIn ? register : clearCache
  }
})

$(document).ready(function registerAccountAjax () {
  VuFind.account.register('fines', {
    selector: '.fines-status',
    ajaxMethod: 'getUserFines',
    render: function render ($element, status, ICON_LEVELS) {
      if (status.value === 0) {
        $element.addClass('hidden')
        return ICON_LEVELS.NONE
      }
      $element.html('<span class="badge overdue">' + status.display + '</span>')
      return ICON_LEVELS.DANGER
    },
    updateNeeded: function updateNeeded (currentStatus, status) {
      return status.total !== currentStatus.value
    }
  })

  VuFind.account.register('checkedOut', {
    selector: '.checkedout-status',
    ajaxMethod: 'getUserTransactions',
    render: function render ($element, status, ICON_LEVELS) {
      let html = ''
      let level = ICON_LEVELS.NONE
      if (status.ok > 0) {
        html += '<span class="badge ok" data-toggle="tooltip" title="' + VuFind.translate('account_normal_checkouts') + '">' + status.ok + '</span>'
      }
      if (status.warn > 0) {
        html += '<span class="badge warn" data-toggle="tooltip" title="' + VuFind.translate('account_checkouts_due') + '">' + status.warn + '</span>'
        level = ICON_LEVELS.WARNING
      }
      if (status.overdue > 0) {
        html += '<span class="badge overdue" data-toggle="tooltip" title="' + VuFind.translate('account_checkouts_overdue') + '">' + status.overdue + '</span>'
        level = ICON_LEVELS.DANGER
      }
      $element.html(html)
      $('[data-toggle="tooltip"]', $element).tooltip()
      return level
    },
    updateNeeded: function updateNeeded (currentStatus, status) {
      return status.ok !== currentStatus.ok || status.warn !== currentStatus.warn || status.overdue !== currentStatus.overdue
    }
  })

  VuFind.account.register('holds', {
    selector: '.holds-status',
    ajaxMethod: 'getUserHolds',
    render: function render ($element, status, ICON_LEVELS) {
      let level = ICON_LEVELS.NONE
      if (status.available > 0) {
        $element.html('<i class="fa fa-bell text-success" data-toggle="tooltip" title="' + VuFind.translate('account_requests_available') + '"></i>')
        level = ICON_LEVELS.GOOD
      } else if (status.in_transit > 0) {
        $element.html('<i class="fa fa-clock-o text-warning" data-toggle="tooltip" title="' + VuFind.translate('account_requests_in_transit') + '"></i>')
      } else {
        $element.addClass('holds-status hidden')
      }
      $('[data-toggle="tooltip"]', $element).tooltip()
      return level
    },
    updateNeeded: function updateNeeded (currentStatus, status) {
      return status.available !== currentStatus.available || status.in_transit !== currentStatus.in_transit
    }
  })

  VuFind.account.register('illRequests', {
    selector: '.illrequests-status',
    ajaxMethod: 'getUserILLRequests',
    render: function render ($element, status, ICON_LEVELS) {
      let level = ICON_LEVELS.NONE
      if (status.available > 0) {
        $element.html('<i class="fa fa-bell text-success" data-toggle="tooltip" title="' + VuFind.translate('account_requests_available') + '"></i>')
        level = ICON_LEVELS.GOOD
      } else if (status.in_transit > 0) {
        $element.html('<i class="fa fa-clock-o text-warning" data-toggle="tooltip" title="' + VuFind.translate('account_requests_in_transit') + '"></i>')
      } else {
        $element.addClass('holds-status hidden')
      }
      $('[data-toggle="tooltip"]', $element).tooltip()
      return level
    },
    updateNeeded: function updateNeeded (currentStatus, status) {
      return status.available !== currentStatus.available || status.in_transit !== currentStatus.in_transit
    }
  })

  VuFind.account.register('storageRetrievalRequests', {
    selector: '.storageretrievalrequests-status',
    ajaxMethod: 'getUserStorageRetrievalRequests',
    render: function render ($element, status, ICON_LEVELS) {
      let level = ICON_LEVELS.NONE
      if (status.available > 0) {
        $element.html('<i class="fa fa-bell text-success" data-toggle="tooltip" title="' + VuFind.translate('account_requests_available') + '"></i>')
        level = ICON_LEVELS.GOOD
      } else if (status.in_transit > 0) {
        $element.html('<i class="fa fa-clock-o text-warning" data-toggle="tooltip" title="' + VuFind.translate('account_requests_in_transit') + '"></i>')
      } else {
        $element.addClass('holds-status hidden')
      }
      $('[data-toggle="tooltip"]', $element).tooltip()
      return level
    },
    updateNeeded: function updateNeeded (currentStatus, status) {
      return status.available !== currentStatus.available || status.in_transit !== currentStatus.in_transit
    }
  })
})
