const zdpUrlParams = new URLSearchParams(window.location.search);
const shouldLoadZDP = zdpUrlParams.has('zdp-id');

const getSearchParam = (param) => {
    return zdpUrlParams.get(param);
}

if (shouldLoadZDP) {
  if (getSearchParam('zdp-id') || getSearchParam('copilotEditor')) {
    const script = document.createElement('script')
    script.src = 'https://pilot.adobedemo.com/loader/loader.js'
    document.head.appendChild(script)
  }
}

