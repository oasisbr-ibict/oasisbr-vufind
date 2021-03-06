/* global Hunt, VuFind */
VuFind.register('doi', function Doi () {
  function embedDoiLinks (el) {
    const element = $(el)
    const doi = []
    const elements = element.hasClass('doiLink') ? element : element.find('.doiLink')
    elements.each(function extractDoiData (i, doiLinkEl) {
      const currentDoi = $(doiLinkEl).data('doi')
      if (doi.indexOf(currentDoi) === -1) {
        doi[doi.length] = currentDoi
      }
    })
    if (doi.length === 0) {
      return
    }
    const url = VuFind.path + '/AJAX/JSON?' + $.param({
      method: 'doiLookup',
      doi: doi
    })
    $.ajax({
      dataType: 'json',
      url: url
    })
      .done(function embedDoiLinksDone (response) {
        elements.each(function populateDoiLinks (x, doiEl) {
          const currentDoi = $(doiEl).data('doi')
          if (typeof response.data[currentDoi] !== 'undefined') {
            $(doiEl).empty()
            for (let i = 0; i < response.data[currentDoi].length; i++) {
              const newLink = $('<a />')
              newLink.attr('href', response.data[currentDoi][i].link)
              newLink.text(' ' + response.data[currentDoi][i].label)
              if (typeof response.data[currentDoi][i].icon !== 'undefined') {
                const icon = $('<img />')
                icon.attr('src', response.data[currentDoi][i].icon)
                icon.attr('class', 'doi-icon')
                $(doiEl).append(icon)
              }
              $(doiEl).append(newLink)
              $(doiEl).append('<br />')
            }
          }
        })
      })
  }

  // Assign actions to the OpenURL links. This can be called with a container e.g. when
  // combined results fetched with AJAX are loaded.
  function init (_container) {
    const container = _container || $('body')
    // assign action to the openUrlWindow link class
    if (typeof Hunt === 'undefined') {
      embedDoiLinks(container)
    } else {
      new Hunt(
        container.find('.doiLink').toArray(),
        { enter: embedDoiLinks }
      )
    }
  }
  return {
    init: init,
    embedDoiLinks: embedDoiLinks
  }
})
