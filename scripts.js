(function () {
    const BROKER_URL = `http://${location.hostname}:3002`;
    const LOCAL_DEVICE_URL = 'http://localhost:3003';
    const CLIENT_ID = 'yanux-skeletron';

    const FeathersCoordinator = YanuxCoordinator.FeathersCoordinator;
    const Credentials = YanuxCoordinator.Credentials;

    window.addEventListener('DOMContentLoaded', function (e) {
        console.log('[YanuX Skeletron] Initializing');
        document.getElementsByName('weight').item(0).addEventListener('change', function () { updateBmi(); });
        document.getElementsByName('height').item(0).addEventListener('change', function () { updateBmi(); })
        initLogin();
    });

    function BmiState(weight = 0, height = 0, result = 0) {
        this.weight = weight;
        this.height = height;
        this.result = result;
    }

    let bmiState = new BmiState();
    //window.bmiState = bmiState;

    let coordinator = null;
    //window.coordinator = coordinator;

    /**
     * TODO: Highlight BMI values based on categorical ranges.
     */
    async function updateBmi(data, reset = false) {
        const weight = data ? data.weight : null;
        const height = data ? data.height : null;
        const result = data ? data.result : null;

        console.log('[YanuX Skeletron] Update BMI Weight:', weight, 'Height:', height, 'Result', result);
        console.log('[YanuX Skeletron] Current BMI State', bmiState);
        if (weight !== bmiState.weight || height !== bmiState.height || result !== bmiState.result) {
            if (reset) {
                bmiState.weight = 0.0;
                bmiState.height = 0.0;
            } else {
                bmiState.weight = weight || parseFloat(document.getElementById('weight').value);
                bmiState.height = height || parseFloat(document.getElementById('height').value);
            }
            bmiState.result = result || bmiState.weight / Math.pow(bmiState.height, 2);

            document.getElementsByName('weight').item(0).value = bmiState.weight;
            document.getElementsByName('height').item(0).value = bmiState.height.toFixed(2);

            if (isFinite(bmiState.result)) {
                document.getElementById('result').textContent = bmiState.result.toFixed(2);
            } else {
                document.getElementById('result').textContent = 'Invalid';
            }

            bmiState.result = !isNaN(bmiState.result) && isFinite(bmiState.result) ? bmiState.result : null;
            console.log('[YanuX Skeletron] New BMI State', bmiState, 'Subscribed Resource Id', coordinator.subscribedResourceId);
            try {
                const result = await coordinator.setResourceData(bmiState, coordinator.subscribedResourceId);
                console.log('[YanuX Skeletron] Resource Data was Set:', result);
            } catch (e) { console.error('[YanuX Skeletron] Error Setting Resource Data:', e); }
        }
    }

    function initLogin() {
        console.log('[YanuX Skeletron] Location Hash', location.hash);
        const params = new URLSearchParams(location.hash.substring(1));
        const newAccessToken = params.get('access_token');
        console.log('[YanuX Skeletron] New Access Token', newAccessToken);
        if (newAccessToken) {
            localStorage.setItem('access_token', newAccessToken);
            location.hash = '';
        }

        const storedAccessToken = localStorage.getItem('access_token');
        console.log('[YanuX Skeletron] Stored Access Token', storedAccessToken);
        const loginButton = document.querySelector('#login > a');
        if (storedAccessToken) {
            loginButton.textContent = 'Logout';
            loginButton.onclick = function (e) {
                console.log('[YanuX Skeletron] Logout');
                localStorage.clear();
                location.reload();
            }
            initYanuxCoordinator(new Credentials("yanux", [storedAccessToken, CLIENT_ID]));
        } else {
            loginButton.setAttribute('href',
                `http://${location.hostname}:3001/oauth2/authorize?client_id=yanux-skeletron&response_type=token&redirect_uri=${location.href}`);
            alert('Please use the button on the top left corner to login into the application.')
        }
    }

    async function resourceSelected(e) {
        console.log('[YanuX Skeletron] Resource Selected:', e.detail);
        try {
            const data = await coordinator.selectResource(resourceSubscriptionHandler, e.detail.selectedResourceId);
            console.log('[YanuX Skeletron] Selected Resource Data:', data);
            updateBmi(data);
        } catch (e) {
            console.error('[YanuX Skeletron] Error Selecting Resource:', e);
            alert('Error Selecting Resource', err.message);
        }
    }

    async function createResource(e) {
        console.log('[YanuX Skeletron] Create Resource:', e.detail);
        try {
            const resource = await coordinator.createResource(e.detail.resourceName);
            const data = await coordinator.selectResource(resourceSubscriptionHandler, resource.id);
            updateBmi(data, true);
        } catch (e) {
            console.error('[YanuX Skeletron] Error Creating Resource:', e);
            alert('Error Creating Resource', err.message);
        }
    }

    async function renameResource(e) {
        console.log('[YanuX Skeletron] Rename Resource:', e.detail);
        try {
            await coordinator.renameResource(e.detail.resourceName, e.detail.resourceId);
            updateResources();
        } catch (e) {
            console.error('[YanuX Skeletron] Error Renaming Resource:', e);
            alert('Error Renaming Resource', err.message);
        }
    }

    async function deleteResource(e) {
        console.log('[YanuX Skeletron] Delete Resource:', e.detail);
        try {
            await coordinator.deleteResource(e.detail.resourceId);
            updateResources();
            const data = await coordinator.selectResource(resourceSubscriptionHandler, coordinator.resource.id);
            updateBmi(data);
        } catch (e) {
            console.error('[YanuX Skeletron] Error Deleting Resource:', e);
            alert('Error Deleting Resource', err.message);
        }
    }

    async function shareResource(e) {
        console.log('[YanuX Skeletron] Share Resource:', e.detail);
        try {
            await coordinator.shareResource(e.detail.userEmail, e.detail.resourceId);
            updateResources();
        } catch (e) {
            console.error('[YanuX Skeletron] Error Sharing Resource:', e);
            alert('Error Sharing Resource', err.message);
        }

    }

    async function unshareResource(e) {
        console.log('[YanuX Skeletron] Unshare Resource:', e.detail);
        try {
            await coordinator.unshareResource(e.detail.userEmail, e.detail.resourceId);
            updateResources();
        } catch (e) {
            console.error('[YanuX Skeletron] Error Unsharing Resource:', e);
            alert('Error Unsharing Resource', err.message);
        }

    }
    function initYanuxResourceElement() {
        const resourceManagementElement = document.getElementById('yxrm');
        resourceManagementElement.addEventListener('resource-selected', resourceSelected);
        resourceManagementElement.addEventListener('create-resource', createResource);
        resourceManagementElement.addEventListener('rename-resource', renameResource);
        resourceManagementElement.addEventListener('delete-resource', deleteResource);
        resourceManagementElement.addEventListener('share-resource', shareResource);
        resourceManagementElement.addEventListener('unshare-resource', unshareResource);
        updateResources();
    }

    async function updateResources() {
        try {
            const resources = await coordinator.getResources();
            console.log('[YanuX Skeletron] Resources:', resources);
            const resourceManagementElement = document.getElementById('yxrm');
            resourceManagementElement.userId = coordinator.user.id;
            resourceManagementElement.resources = resources;
            resourceManagementElement.selectedResourceId = coordinator.subscribedResourceId;
        } catch (e) { console.error('[YanuX Skeletron] Error Retrieving Resources:', e); }
    }

    function resourceSubscriptionHandler(data, eventType) {
        console.log('[YanuX Skeletron] Resource Subscriber Handler Data:', data, 'Event Type:', eventType);
        updateBmi(data);
    }

    function resourcesSubscriptionHandler(data, eventType) {
        console.log('[YanuX Skeletron] Resources Subscriber Handler Data:', data, 'Event Type:', eventType);
        updateResources();
    }

    async function resourceSubscriptionSubscriptionHandler(data, eventType) {
        console.log('[YanuX Skeletron] Resource Subscription Subscriber Handler Data:', data, 'Event Type:', eventType);
        if (eventType !== 'removed') {
            const resourceData = await coordinator.selectResource(resourceSubscriptionHandler, data.resource);
            updateBmi(resourceData, true);
        }
    }

    function proxemicsSubscriptionHandler(data, eventType) {
        console.log('[YanuX Skeletron] Proxemics Subscriber Handler Data:', data, 'Event Type:', eventType);
    }

    function instancesSubscriptionHandler(data, eventType) {
        console.log('[YanuX Skeletron] Instances Subscription Handler Data:', data, 'Event Type:', eventType);
    }

    function eventsSubcriptionHandler(data, eventType) {
        console.log('[YanuX Skeletron] Events Subscription Handler Data:', data, 'Event Type:', eventType);
    }

    function reconnectSubscriptionHandler(state, proxemics, resourceId) {
        console.log('[YanuX Skeletron] Reconnect Subscription Handler State:', state, 'Proxemics:', proxemics, 'Resource Id:', resourceId);
    }

    function showUi() {
        document.getElementById('overlay').style.display = 'none';
        document.getElementsByTagName('main').item(0).style.display = 'block';
    }

    async function initYanuxCoordinator(credentials) {
        coordinator = new FeathersCoordinator(BROKER_URL, LOCAL_DEVICE_URL, CLIENT_ID, credentials);
        console.log('[YanuX Skeletron] Coordinator Created:', coordinator);
        try {
            /**
             * NOTE:
             * I'll probably be using async/await in this example instead of Promises because they are probably easier to understand.
             * I often overuse Promises because they give more explicit control at the cost of readibility. However, I'm pretty used to them.
             * For new users async/await is closer to how synchronous code look which is probably what they are more familiar with.
             */
            const [data, proxemics, resourceId] = await coordinator.init();
            console.log('[YanuX Skeletron] Coordinator Initialized Data:', data, 'Proxemics:', proxemics, 'Resource Id:', resourceId);
            coordinator.subscribeResource(resourceSubscriptionHandler, coordinator.subscribedResourceId);
            coordinator.subscribeResources(resourcesSubscriptionHandler);
            coordinator.subscribeResourceSubscription(resourceSubscriptionSubscriptionHandler);
            coordinator.subscribeProxemics(proxemicsSubscriptionHandler);
            coordinator.subscribeInstances(instancesSubscriptionHandler);
            coordinator.subscribeEvents(eventsSubcriptionHandler);
            coordinator.subscribeReconnects(reconnectSubscriptionHandler);

            updateBmi(data);
            initYanuxResourceElement();
            showUi();
        } catch (e) { console.error('[YanuX Skeletron] Coordinator Initialization Error:', e); }
    }
})();