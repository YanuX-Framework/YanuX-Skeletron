(function () {
    const BROKER_URL = `http://${location.hostname}:3002`;
    const LOCAL_DEVICE_URL = 'http://localhost:3003';
    const CLIENT_ID = 'yanux-skeletron';

    const FeathersCoordinator = YanuxCoordinator.FeathersCoordinator;
    const Credentials = YanuxCoordinator.Credentials;
    const ComponentsRuleEngine = YanuxCoordinator.ComponentsRuleEngine;
    const InstancesComponentsDistribution = YanuxCoordinator.InstancesComponentsDistribution;

    function BmiState(weight = 0, height = 0, result = 0) {
        this.weight = weight;
        this.height = height;
        this.result = result;
    }

    const bmiState = new BmiState();
    //window.bmiState = bmiState;

    let coordinator = null;
    //window.coordinator = coordinator;

    let componentsRuleEngine = null;
    //window.componentsRuleEngine = componentsRuleEngine;

    const componentsRestrictions = {
        "Display": {
            "display": {
                "operator": "AND",
                "values": {
                    "virtualResolution": {
                        "operator": ">=",
                        "value": [960, null]
                    },
                    "size": {
                        "operator": ">=",
                        "value": [160, 90],
                        "enforce": false
                    }
                }
            }
        },
        "Form": {
            "display": true,
            "input": {
                "operator": "OR",
                "values": [{
                    "operator": "AND",
                    "values": ["keyboard", "mouse"]
                }, "touchscreen"]
            }
        }
    }

    window.addEventListener('DOMContentLoaded', async function (e) {
        async function onChange() {
            try { await updateBmi(); }
            catch (e) { console.error('[YanuX Skeletron] onChange Error:', e) }
        }

        console.log('[YanuX Skeletron] Initializing');
        document.getElementsByName('weight').item(0).addEventListener('change', onChange);
        document.getElementsByName('height').item(0).addEventListener('change', onChange)

        try { initLogin(); }
        catch (e) { console.error('[YanuX Skeletron] Error Initializing Login:', e); }
    });

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

            if (!isNaN(bmiState.result) && isFinite(bmiState.result)) {
                document.getElementById('result').textContent = bmiState.result.toFixed(2);
            } else {
                document.getElementById('result').textContent = 'Invalid';
                bmiState.result = null;
            }

            console.log('[YanuX Skeletron] New BMI State', bmiState, 'Subscribed Resource Id', coordinator.subscribedResourceId);
            try {
                const result = await coordinator.setResourceData(bmiState, coordinator.subscribedResourceId);
                console.log('[YanuX Skeletron] Resource Data was Set:', result);
            } catch (e) { console.error('[YanuX Skeletron] Error Setting Resource Data:', e); }
        }
    }

    async function initLogin() {
        console.log('[YanuX Skeletron] Initializing Login');
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
            try { await initYanuxCoordinator(new Credentials("yanux", [storedAccessToken, CLIENT_ID])); }
            catch (e) { console.error('[YanuX Skeletron] Error Initializing YanuX Coordinator:', e); }
        } else {
            loginButton.setAttribute('href',
                `http://${location.hostname}:3001/oauth2/authorize?client_id=yanux-skeletron&response_type=token&redirect_uri=${location.href}`);
            alert('Please use the button on the top left corner to login into the application.')
        }
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
            coordinator.subscribeReconnects(reconnectSubscriptionHandler);

            componentsRuleEngine = new ComponentsRuleEngine(
                coordinator.instance.instanceUuid,
                coordinator.device.deviceUuid,
                componentsRestrictions
            );

            await Promise.all([
                initYanuxResourceManagementElement(),
                initYanuxComponentsDistributionElement(),
                updateBmi(data)
            ]);
            showUi();
        } catch (e) { console.error('[YanuX Skeletron] Coordinator Initialization Error:', e); }
    }

    async function resourceSubscriptionHandler(data, eventType) {
        console.log('[YanuX Skeletron] Resource Subscriber Handler Data:', data, 'Event Type:', eventType);
        try { await updateBmi(data); }
        catch (e) { console.error('[YanuX Skeletron] Error Updating BMI:', e) }
    }

    async function resourcesSubscriptionHandler(data, eventType) {
        console.log('[YanuX Skeletron] Resources Subscriber Handler Data:', data, 'Event Type:', eventType);
        try { await updateResources(); }
        catch (e) { console.error('[YanuX Skeletron] Error Updating Resources:', e) }
    }

    async function resourceSubscriptionSubscriptionHandler(data, eventType) {
        console.log('[YanuX Skeletron] Resource Subscription Subscriber Handler Data:', data, 'Event Type:', eventType);
        if (eventType !== 'removed') {
            try {
                const resourceData = await coordinator.selectResource(resourceSubscriptionHandler, data.resource);
                await updateBmi(resourceData, true);
            } catch (e) { console.error('[YanuX Skeeltron] Resource Subscription Subscriber Handler Error:', e); }
        }
    }

    async function proxemicsSubscriptionHandler(data, eventType) {
        console.log('[YanuX Skeletron] Proxemics Subscriber Handler Data:', data, 'Event Type:', eventType);
        try { await updateComponentsDistribution(); }
        catch (e) { console.error('[YanuX Skeletron] Error Updating Instances:', e) }
    }

    async function instancesSubscriptionHandler(data, eventType) {
        console.log('[YanuX Skeletron] Instances Subscription Handler Data:', data, 'Event Type:', eventType);
        try { await updateComponentsDistribution(); }
        catch (e) { console.error('[YanuX Skeletron] Error Updating Instances:', e) }
    }

    async function reconnectSubscriptionHandler(state, proxemics, resourceId) {
        console.log('[YanuX Skeletron] Reconnect Subscription Handler State:', state, 'Proxemics:', proxemics, 'Resource Id:', resourceId);
        updateBmi(state)
    }

    function showUi() {
        console.log('[YanuX Skeletron] Showing UI');
        document.getElementById('overlay').style.display = 'none';
        document.getElementsByTagName('main').item(0).style.display = 'block';
    }

    async function updateResources() {
        console.log('[YanuX Skeletron] Updating Resources');
        try {
            const resources = await coordinator.getResources();
            console.log('[YanuX Skeletron] Resources:', resources);
            const resourceManagementElement = document.getElementById('yxrm');
            resourceManagementElement.userId = coordinator.user.id;
            resourceManagementElement.resources = resources;
            resourceManagementElement.selectedResourceId = coordinator.subscribedResourceId;
        } catch (e) { console.error('[YanuX Skeletron] Error Retrieving Resources:', e); }
    }

    async function initYanuxResourceManagementElement() {
        console.log('[YanuX Skeletron] Initializing Resource Management Element');
        try {
            const resourceManagementElement = document.getElementById('yxrm');
            resourceManagementElement.addEventListener('resource-selected', resourceSelected);
            resourceManagementElement.addEventListener('create-resource', createResource);
            resourceManagementElement.addEventListener('rename-resource', renameResource);
            resourceManagementElement.addEventListener('delete-resource', deleteResource);
            resourceManagementElement.addEventListener('share-resource', shareResource);
            resourceManagementElement.addEventListener('unshare-resource', unshareResource);
            await updateResources();
        } catch (e) { console.error('[YanuX Skeletron] Error Initializing Resource Management Element:', e); }
    }

    //TODO: Move the core logic to FeathersCoordinator
    async function updateComponentsDistribution(ignoreManual = false) {
        console.log('[YanuX Skeletron] Update Components Distribution -- ignoreManual:', ignoreManual)
        try {
            const activeInstances = await coordinator.getActiveInstances();
            const componentsDistributionElement = document.getElementById('yxcd');
            componentsDistributionElement.instanceId = coordinator.instance.id;
            instancesComponentsDistribution = new InstancesComponentsDistribution(activeInstances);
            componentsDistributionElement.componentsDistribution = instancesComponentsDistribution;

            componentsRuleEngine.instances = activeInstances;
            componentsRuleEngine.proxemics = coordinator.proxemics.state;

            const result = await componentsRuleEngine.run(ignoreManual);
            const instance = await coordinator.setComponentDistribution(result.componentsConfig, result.auto, coordinator.instance.id)
            console.log('[YanuX Skeletron] Updated Components Distribution -- Instance:', instance);
            configureComponents(instance.componentsDistribution);
        } catch (e) { console.error('[YanuX Skeletron] Error Updating Components Distribution:', e) }
    }

    function configureComponents(componentsConfig) {
        const displayDisplay = componentsConfig.components && componentsConfig.components.Display === true ? 'block' : 'none';
        const formDisplay = componentsConfig.components && componentsConfig.components.Form === true ? 'block' : 'none';
        document.getElementById('display').style.display = displayDisplay;
        document.getElementById('form').style.display = formDisplay;
        console.log('[YanuX Skeletron] Configure Components Display:', displayDisplay, 'Form:', formDisplay)
    }

    async function resourceSelected(e) {
        console.log('[YanuX Skeletron] Resource Selected:', e.detail);
        try {
            const data = await coordinator.selectResource(resourceSubscriptionHandler, e.detail.selectedResourceId);
            console.log('[YanuX Skeletron] Selected Resource Data:', data);
            await updateBmi(data);
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
            await updateBmi(data, true);
        } catch (e) {
            console.error('[YanuX Skeletron] Error Creating Resource:', e);
            alert('Error Creating Resource', err.message);
        }
    }

    async function renameResource(e) {
        console.log('[YanuX Skeletron] Rename Resource:', e.detail);
        try {
            await coordinator.renameResource(e.detail.resourceName, e.detail.resourceId);
            await updateResources();
        } catch (e) {
            console.error('[YanuX Skeletron] Error Renaming Resource:', e);
            alert('Error Renaming Resource', err.message);
        }
    }

    async function deleteResource(e) {
        console.log('[YanuX Skeletron] Delete Resource:', e.detail);
        try {
            await coordinator.deleteResource(e.detail.resourceId);
            await updateResources();
            const resourceManagementElement = document.getElementById('yxrm');
            const data = await coordinator.selectResource(resourceSubscriptionHandler, resourceManagementElement.selectedResourceId);
            await updateBmi(data);
        } catch (e) {
            console.error('[YanuX Skeletron] Error Deleting Resource:', e);
            alert('Error Deleting Resource', err.message);
        }
    }

    async function shareResource(e) {
        console.log('[YanuX Skeletron] Share Resource:', e.detail);
        try {
            await coordinator.shareResource(e.detail.userEmail, e.detail.resourceId);
            await updateResources();
        } catch (e) {
            console.error('[YanuX Skeletron] Error Sharing Resource:', e);
            alert('Error Sharing Resource', err.message);
        }
    }

    async function unshareResource(e) {
        console.log('[YanuX Skeletron] Unshare Resource:', e.detail);
        try {
            await coordinator.unshareResource(e.detail.userEmail, e.detail.resourceId);
            await updateResources();
        } catch (e) {
            console.error('[YanuX Skeletron] Error Unsharing Resource:', e);
            alert('Error Unsharing Resource', err.message);
        }
    }

    async function initYanuxComponentsDistributionElement() {
        console.log('[YanuX Skeletron] Initializing Components Distribution Element')
        try {
            const componentsDistributionElement = document.getElementById('yxcd');
            componentsDistributionElement.addEventListener('updated-components-distribution', updatedComponentsDistribution);
            componentsDistributionElement.addEventListener('reset-auto-components-distribution', resetAutoComponentsDistribution);
            await updateComponentsDistribution()
        } catch (e) { console.error('[YanuX Skeletron] Error Initializing Components Distribution Element:', e); };
    }

    //TODO: Move the core logic to FeathersCoordinator
    async function updatedComponentsDistribution(e) {
        console.log('[YanuX Skeletron] Updating Components Distribution:', e.detail);
        const componentsDistribution = e && e.detail && e.detail.componentsDistribution ? e.detail.componentsDistribution : null
        if (componentsDistribution) {
            try {
                const results = await Promise.all(Object.keys(componentsDistribution).map(instanceId =>
                    coordinator.setComponentDistribution(
                        componentsDistribution[instanceId].components,
                        componentsDistribution[instanceId].auto,
                        instanceId
                    )));
                console.log('[YanuX Skeletron] Updated Components Distribution:', results);
            } catch (e) { console.log('[YanuX Skeletron] Error Updating Components Distribution:', e); }
        }
    }

    //TODO: Move the core logic to FeathersCoordinator
    async function resetAutoComponentsDistribution(e) {
        console.log('[YanuX Skeletron] Resetting Auto Components Distribution:', e.detail);
        await updateComponentsDistribution(true);
    }
})();