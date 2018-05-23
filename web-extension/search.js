'use strict';

let searching, searchedUrl, searchTerm;

function initSearch() {
    const input = document.getElementById('search_input');

    input.addEventListener('input', _onSearchInputEvent);
    input.addEventListener('keypress', _onSearchKeypressEvent);

    setTimeout(() => {
        input.focus();
    }, 200);
}

function _onSearchKeypressEvent(event) {
    if (event.keyCode === 13) {
        const elements = document.getElementsByClassName('login');
        if (elements.length === 1) {
            const value = elements[0].innerText;
            const message = { type: 'getLogin', entry: value };
            if (event.shiftKey) {
                sendNativeAppMessage(message).then(onLoginCredentialsDoCopyClipboard, onLoginCredentialError);
            } else {
                sendNativeAppMessage(message).then(onLoginCredentialsDoLogin, onLoginCredentialError);
            }
        }
        event.preventDefault();
    }
}

function _onSearchInputEvent() {
    const input = document.getElementById('search_input');
    const currentHost = urlDomain(currentTab.url);
    if (input.value.length) {
        search(input.value);
    } else {
        searchHost(currentHost);
    }
}

function search(query) {
    if (searching) {
        console.log('Search still in progress, skipping query ' + query);
        return;
    }
    armSpinnerTimeout();
    searchTerm = query;
    document.getElementById('search_input').value = query;
    if (!query) {
        console.log('Will not search for empty string');
        return;
    }
    console.log('Searching for string ' + query);
    searching = true;
    searchedUrl = currentTab.url;
    sendNativeAppMessage({ type: 'query', query: query }).then(result => onSearchResults(result, false), onSearchError);
}

function searchHost(term) {
    if (searching) {
        console.log('Search still in progress, skipping query ' + term);
        return;
    }
    armSpinnerTimeout();
    browser.storage.local.remove(LAST_DOMAIN_SEARCH_PREFIX + term);
    searchTerm = term;
    document.getElementById('search_input').value = '';
    console.log('Searching for host ' + term);
    searching = true;
    searchedUrl = currentTab.url;
    sendNativeAppMessage({ type: 'queryHost', host: term }).then(
        result => onSearchResults(result, true),
        onSearchError
    );
}

function _faviconUrl() {
    if (currentTab && currentTab.favIconUrl && currentTab.favIconUrl.indexOf(urlDomain(currentTab.url)) > -1) {
        return currentTab.favIconUrl;
    }

    return 'icons/si-glyph-key-2.svg';
}

function onSearchResults(response, isHostQuery) {
    const results = document.getElementById('results');
    clearTimeout(spinnerTimeout);
    if (response.error) {
        setStatusText(response.error);
        return;
    }
    if (currentTab.url !== searchedUrl) {
        console.log('Result is not from the same URL as we were searching for, ignoring');
    }
    if (response.length) {
        setLocalStorageKey(
            LAST_DOMAIN_SEARCH_PREFIX + urlDomain(currentTab.url),
            document.getElementById('search_input').value
        );
        results.innerHTML = '';
        response.forEach(result => {
            results.appendChild(
                createButtonWithCallback(
                    'login',
                    result,
                    `background-image: url('${isHostQuery ? _faviconUrl() : 'icons/si-glyph-key-2.svg'}')`,
                    resultSelected
                )
            );
        });
    } else {
        browser.storage.local.remove(LAST_DOMAIN_SEARCH_PREFIX + urlDomain(currentTab.url));
        setStatusText(i18n.getMessage('noResultsForMessage') + ' ' + searchTerm);
        results.appendChild(
            createButtonWithCallback(
                'login',
                i18n.getMessage('createNewEntryButtonText'),
                null,
                switchToCreateNewDialog
            )
        );
    }
    searching = false;
}

function onSearchError(error) {
    setStatusText(error.message);
}

function resultSelected(event) {
    const value = event.target.innerText;
    const message = { type: 'getLogin', entry: value };
    if (event.shiftKey) {
        sendNativeAppMessage(message).then(onLoginCredentialsDoCopyClipboard, logAndDisplayError);
    } else {
        sendNativeAppMessage(message).then(onLoginCredentialsDoLogin, logAndDisplayError);
    }
}

function onLoginCredentialsDoCopyClipboard(response) {
    const content = document.getElementById('content');

    if (response.error) {
        setStatusText(response.error);
        return;
    }
    const hiddenpass = document.createElement('span');
    hiddenpass.textContent = response.password;
    content.appendChild(hiddenpass);
    const tempinput = document.createElement('input');
    tempinput.value = response.password;
    content.appendChild(tempinput);
    tempinput.select();
    document.execCommand('copy');
    content.innerHTML = `<div class="copied">${i18n.getMessage('copiedToClipboardMessage')}</div>`;
    setTimeout(window.close, 1000);
}

function onLoginCredentialsDoLogin(response) {
    if (response.error) {
        setStatusText(response.error);
        return;
    }

    if (response.username === urlDomain(currentTab.url)) {
        setStatusText(i18n.getMessage('couldNotDetermineUsernameMessage'));
        return;
    }

    browser.tabs.sendMessage(currentTab.id, {
        type: 'FILL_LOGIN_FIELDS',
        login: response.username,
        password: response.password,
    });

    executeOnSetting(
        'submitafterfill',
        () => {
            browser.tabs.sendMessage(currentTab.id, { type: 'TRY_LOGIN' });
            window.close();
        },
        () => {
            window.close();
        }
    );
}

initSearch();
