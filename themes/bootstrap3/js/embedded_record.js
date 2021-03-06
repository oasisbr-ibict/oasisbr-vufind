/* global checkSaveStatuses, registerAjaxCommentRecord, registerTabEvents, syn_get_widget, VuFind */
VuFind.register('embedded', function embedded () {
  const _STORAGEKEY = 'vufind_search_open'
  const _SEPERATOR = ':::'
  const _DELIM = ','
  const _STATUS = {}

  function saveStatusToStorage () {
    const storage = []
    let str
    for (str in _STATUS) {
      if ({}.hasOwnProperty.call(_STATUS, str)) {
        if (_STATUS[str]) {
          str += _SEPERATOR + _STATUS[str]
        }
        storage.push(str)
      }
    }
    sessionStorage.setItem(_STORAGEKEY, $.unique(storage).join(_DELIM))
  }
  function addToStorage (id, tab) {
    _STATUS[id] = tab
    saveStatusToStorage()
  }
  function removeFromStorage (id) {
    if (delete _STATUS[id]) {
      saveStatusToStorage()
    }
  }

  function ajaxLoadTab (tabid, _click) {
    const click = _click || false
    const $tab = $('#' + tabid)
    const $result = $tab.closest('.result')
    if ($result.length === 0) {
      return true
    }
    const id = $result.find('.hiddenId')[0].value
    const source = $result.find('.hiddenSource')[0].value
    if ($tab.parent().hasClass('noajax')) {
      if ($tab.is('a')) {
        // tab case:
        window.location.href = $tab.attr('href')
      } else {
        // accordion case:
        window.location.href = $tab.find('a').attr('data-href')
      }
      return false
    }
    let urlroot
    if (source === VuFind.defaultSearchBackend) {
      urlroot = 'Record'
    } else {
      urlroot = source.charAt(0).toUpperCase() + source.slice(1).toLowerCase() + 'Record'
    }
    if (!$tab.hasClass('loaded')) {
      $('#' + tabid + '-content').html(
        '<i class="fa fa-spinner fa-spin"></i> ' + VuFind.translate('loading') + '...'
      )
      let tab = tabid.split('_')
      tab = tab[0]
      $.ajax({
        url: VuFind.path + '/' + urlroot + '/' + encodeURIComponent(id) + '/AjaxTab',
        type: 'POST',
        data: { tab: tab },
        success: function ajaxTabSuccess (data) {
          const html = data.trim()
          if (html.length > 0) {
            $('#' + tabid + '-content').html(html)
            registerTabEvents()
          } else {
            $('#' + tabid + '-content').html(VuFind.translate('collection_empty'))
          }
          if (typeof syn_get_widget === 'function') {
            syn_get_widget()
          }
          $('#' + tabid).addClass('loaded')
        }
      })
    }
    if (click && !$tab.parent().hasClass('default')) {
      $tab.click()
    }
    return true
  }

  function toggleDataView (_link, tabid) {
    const $link = $(_link)
    const viewType = $link.attr('data-view')
    // If full, return true
    if (viewType === 'full') {
      return true
    }
    const result = $link.closest('.result')
    const mediaBody = result.find('.media-body')
    const shortNode = mediaBody.find('.result-body')
    const linksNode = mediaBody.find('.result-links')
    let longNode = mediaBody.find('.long-view')
    // Insert new elements
    if (!$link.hasClass('js-setup')) {
      $link.prependTo(mediaBody)
      result.addClass('embedded')
      shortNode.addClass('collapse')
      linksNode.addClass('collapse')
      longNode = $('<div class="long-view collapse"></div>')
      // Add loading status
      shortNode
        .before('<div class="loading hidden"><i class="fa fa-spin fa-spinner"></i> ' +
                VuFind.translate('loading') + '...</div>')
        .before(longNode)
      longNode.on('show.bs.collapse', function embeddedExpand () {
        $link.addClass('expanded')
      })
      longNode.on('hidden.bs.collapse', function embeddedCollapsed (e) {
        if ($(e.target).hasClass('long-view')) {
          $link.removeClass('expanded')
        }
      })
      $link.addClass('expanded js-setup')
    }
    // Gather information
    const divID = result.find('.hiddenId')[0].value
    // Toggle visibility
    if (!longNode.is(':visible')) {
      // AJAX for information
      if (longNode.is(':empty')) {
        const loadingNode = mediaBody.find('.loading')
        loadingNode.removeClass('hidden')
        $link.addClass('expanded')
        $.ajax({
          dataType: 'json',
          url: VuFind.path + '/AJAX/JSON?' + $.param({
            method: 'getRecordDetails',
            id: divID,
            type: viewType,
            source: result.find('.hiddenSource')[0].value
          }),
          success: function getRecordDetailsSuccess (response) {
            // Insert tabs html
            longNode.html(response.data.html)
            // Hide loading
            loadingNode.addClass('hidden')
            longNode.collapse('show')
            // Load first tab
            if (tabid) {
              ajaxLoadTab(tabid, true)
            } else {
              let $firstTab = $(longNode).find('.list-tab-toggle.active')
              if ($firstTab.length === 0) {
                $firstTab = $(longNode).find('.list-tab-toggle:eq(0)')
              }
              ajaxLoadTab($firstTab.attr('id'), true)
            }
            // Bind tab clicks
            longNode.find('.list-tab-toggle').click(function embeddedTabLoad () {
              if (!$(this).parent().hasClass('noajax')) {
                addToStorage(divID, this.id)
              }
              return ajaxLoadTab(this.id)
            })
            longNode.find('[id^=usercomment]').find('input[type=submit]').unbind('click').click(
              function embeddedComments () {
                return registerAjaxCommentRecord(longNode)
              }
            )
            longNode.find('[data-background]').each(function setupEmbeddedBackgroundTabs (index, el) {
              ajaxLoadTab(el.id, false)
            })
            // Add events to record toolbar
            VuFind.lightbox.bind(longNode)
            if (typeof checkSaveStatuses === 'function') {
              checkSaveStatuses(longNode)
            }
          }
        })
      } else {
        longNode.collapse('show')
      }
      shortNode.collapse('hide')
      linksNode.collapse('hide')
      if (!$link.hasClass('auto')) {
        addToStorage(divID, $(longNode).find('.list-tab-toggle.active').attr('id'))
      } else {
        $link.removeClass('auto')
      }
    } else {
      shortNode.collapse('show')
      linksNode.collapse('show')
      longNode.collapse('hide')
      removeFromStorage(divID)
    }
    return false
  }

  function loadStorage () {
    const storage = sessionStorage.getItem(_STORAGEKEY)
    if (!storage) {
      return
    }
    const items = storage.split(_DELIM)
    const doomed = []
    let hiddenIds
    let parts
    let result
    let i
    let j
    hiddenIds = $('.hiddenId')
    for (i = 0; i < items.length; i++) {
      parts = items[i].split(_SEPERATOR)
      _STATUS[parts[0]] = parts[1] || null
      result = null
      for (j = 0; j < hiddenIds.length; j++) {
        if (hiddenIds[j].value === parts[0]) {
          result = $(hiddenIds[j]).closest('.result')
          break
        }
      }
      if (result === null) {
        doomed.push(parts[0])
        continue
      }
      const $link = result.find('.getFull')
      $link.addClass('auto expanded')
      toggleDataView($link, parts[1])
    }
    for (i = 0; i < doomed.length; i++) {
      removeFromStorage(doomed[i])
    }
  }

  function init () {
    $('.getFull').click(function linkToggle () { return toggleDataView(this) })
    loadStorage()
  }

  return { init: init }
})
