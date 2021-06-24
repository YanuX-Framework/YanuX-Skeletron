/**
 * Importing components/classes from the YanuX Coordinator library
 */
import { FeathersCoordinator, Credentials, ComponentsRuleEngine, Proxemics, ComponentsDistribution } from "@yanux/coordinator";

/**
 * This is the URL that you can use to connect the YanuX Coordinator to the YanuX Broker.
 */
const BROKER_URL = `http://${location.hostname}:3002`;
/**
 * This is the base URL for the services provided by the YanuX Orchestrator (i.e., by the YanuX Scavenger on Android or the YanuX DesktopClient on PC).
 * In practice, it is used to get the unique identifier of the device running the application.
 */
const LOCAL_DEVICE_URL = 'http://localhost:3003';
/**
 * The ID of the application that was previously registered at the YanuX Auth website.
 */
const CLIENT_ID = 'yanux-skeletron';

/**
 * An object that represents the local state of the application.
 */
const bmiState = { weight: 0, height: 0, result: 0 };

/**
 * Variable declaration for the Coordinator.
 * @type {FeathersCoordinator}
 */
let coordinator = null;

/**
 * Variable declaration for the ComponentsRuleEngine.
 * @type {ComponentsRuleEngine}
 */
let componentsRuleEngine = null;

/**
 * The definition of component restrictions using our DSL.
 * [TODO:] Possible Exercise or Explanation Needed
 */
const componentsRestrictions = {
    "Display": {
        "display": { "virtualResolution": { "operator": ">=", "value": [1024, null], "enforce": false } }
    },
    "Form": {
        "display": true,
        "input": { "operator": "OR", "values": ["mouse", "touchscreen"] },
        "type": { "value": "smartphone", "enforce": false }
    }
}

/**
 * We will only start executing our code once the DOM is fully loaded.
 */
window.addEventListener('DOMContentLoaded', async function (e) {
    console.log('[YanuX Skeletron] Initializing');
    /**
     * Get the "weight" and "height" inputs and whenever they change call the updateBmi function to keep values up-to-date.
     */
    document.getElementsByName('weight').item(0).addEventListener('change', updateBmi);
    document.getElementsByName('height').item(0).addEventListener('change', updateBmi)

    /**
     * [TODO:] A possible starting point is to comment initAuth() below and just show how the application works in "local mode".
     */
    //showUi(true);

    /**
     * Initializing the authentication process which will eventually initialize the YanuX Coordinator components.
     */
    initAuth();
});

/**
 * This function can receive a parameter with the data representing the state of the application.
 * Alternatively, it extracts that information from the form inputs.
 * Either way, the current state is written back to the form inputs.
 * 
 * @todo [TODO:] Highlight BMI values based on categorical ranges.
 * @param {any} data - A parameter with the data representing the state of the application 
 * @param {Boolean} reset - A "reset" flag to reset the state back to the initial values.
 */
async function updateBmi(data, reset = false) {
    const weight = data ? data.weight : null;
    const height = data ? data.height : null;
    const result = data ? data.result : null;

    console.log('[YanuX Skeletron] Current BMI State', bmiState, 'Update BMI Weight:', weight, 'Height:', height, 'Result', result);
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

        /**
         * [TODO:] Possible Exercise. If "coordinator" is initialized save the current application state to the currently subscribed resource.
         */
        if (coordinator) {
            try {
                console.log('[YanuX Skeletron] New BMI State', bmiState, 'Subscribed Resource Id', coordinator.subscribedResourceId);
                /**
                 * Only this line is really important!
                 */
                const result = await coordinator.setResourceData(bmiState, coordinator.subscribedResourceId);
                console.log('[YanuX Skeletron] Resource Data was Set:', result);
            } catch (e) { console.error('[YanuX Skeletron] Error Setting Resource Data:', e); }
        }
    }
}

/**
 * This function changes the initial values of the CSS display properties of some elements that are hidden when the application starts.
 * @param {Boolean} minimal - An optional "minimal" flag to only show the essential elements of the UI (No Authentication and YanuX Custom Elements).
 */
function showUi(minimal = false) {
    console.log('[YanuX Skeletron] Showing UI');
    document.getElementById('overlay').style.display = 'none';

    if (minimal) {
        document.getElementsByTagName('nav').item(0).style.display = 'none';
        Array.from(document.getElementsByClassName('container')).map(c => c.style.display = 'none');
    }

    document.getElementsByTagName('header').item(0).style.display = 'block';
    document.getElementsByTagName('main').item(0).style.display = 'block';
    document.getElementsByTagName('footer').item(0).style.display = 'block';
}

/**
 * Function that initializes the authentication process which will eventually initialize the YanuX Coordinator components.
 * [TODO:] Possible Exercise or Explanation Needed
 */
function initAuth() {
    /**
     * Get the anchor part of the URL (https://www.w3schools.com/jsref/prop_loc_hash.asp)
     */
    console.log('[YanuX Skeletron] Initializing Login -- Location Hash', location.hash);
    /**
     * When using the "OAuth 2.0 Implicit Grant" the access token is returned from the YanuX Auth 
     * as a query string on the anchor part of the URL. The URLSearchParams interface can be used to extract it.
     * Afterwards, we can store the access token on Local Storage.
     */
    const params = new URLSearchParams(location.hash.substring(1));
    const newAccessToken = params.get('access_token');
    console.log('[YanuX Skeletron] New Access Token', newAccessToken);
    if (newAccessToken) {
        localStorage.setItem('access_token', newAccessToken);
        location.hash = '';
    }

    /**
     * We retrieve the token from Local Storage and check if it exists.
     * If it does we change the Login button to a Logout button.
     * We also associate a corresponding "onclick" function 
     * that clears Local Storage and relods the page.
     * 
     * Afterwards we initialize the YanuX Coordinator with the correct Credentials.
     */
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
        /**
         * We initialize the Credentials and pass it to a function
         * that will use these credentials to create a FeathersCoordinator instance.
         * [TODO:] Possible Exercise or Explanation Needed.
         */
        initYanuxCoordinator(new Credentials("yanux", [storedAccessToken, CLIENT_ID]));
        showUi();
    }
    /**
     * If no access token is available we change the login button link to point to YanuX Auth OAuth 2.0 endpoint.
     * We also show an alert just to tell people what to do.
     */
    else {
        loginButton.setAttribute('href',
            `http://${location.hostname}:3001/oauth2/authorize?client_id=yanux-skeletron&response_type=token&redirect_uri=${location.href}`);
        alert('Please use the button on the top left corner to login into the application.')
    }
}

/**
 * Function that initializes the YanuX Coordinator.
 * It receives the Credentials used to connect to the YanuX Broker.
 * @param {Credentials} credentials
 */
async function initYanuxCoordinator(credentials) {
    /**
     * Create a FeathersCoordinator instance with the provided BROKER_URL, LOCAL_DEVICE_URL, CLIENT_ID and credentials.
     * [TODO:] Possible Exercise or Explanation Needed.
     */
    coordinator = new FeathersCoordinator(BROKER_URL, LOCAL_DEVICE_URL, CLIENT_ID, credentials);
    console.log('[YanuX Skeletron] Coordinator Created:', coordinator);
    try {
        /**
         * Initialize it and receive the data from the default resource, the current proxemic information 
         * and the Id of the default resource. 
         */
        const [data, proxemics, resourceId] = await coordinator.init();
        console.log('[YanuX Skeletron] Coordinator Initialized Data:', data, 'Proxemics:', proxemics, 'Resource Id:', resourceId);
        /**
         * Subscribe to the events provided by the Coordinator by providing handler functions.
         * In the case of "subscribeResource" you should also provide the Id of the resource 
         * you are interested in. The "subscribedResourceId" property has the Id of the 
         * currently subscribed to resource.
         * 
         * [NOTE:] "subscribeEvents" and "subscribeReconnects" is not being used in this example.
         * [TODO:] Possible Exercise or Explanation Needed.
         */
        coordinator.subscribeResource(resourceSubscriptionHandler, coordinator.subscribedResourceId);
        coordinator.subscribeResources(resourcesSubscriptionHandler);
        coordinator.subscribeResourceSubscription(resourceSubscriptionSubscriptionHandler);
        coordinator.subscribeProxemics(proxemicsSubscriptionHandler);
        coordinator.subscribeInstances(instancesSubscriptionHandler);

        /**
         * Create a "ComponentsRuleEngine" instance by providing the current UUID of the instance 
         * that is currently being managed by the Coordinator, the UUID of the Device there the
         * current Coordinator instance is running and previously defined components restrictions.
         * 
         * [TODO:] Possible Exercise or Explanation Needed.
         */
        componentsRuleEngine = new ComponentsRuleEngine(
            coordinator.instance.instanceUuid,
            coordinator.device.deviceUuid,
            componentsRestrictions
        );

        /**
         * Also initialize the YanuX Resource Management Element, 
         * the Yanux Components Distribution Element, 
         * and update the application with the most up-to-date state data.
         */
        initYanuxResourceManagementElement()
        initYanuxComponentsDistributionElement()
        updateBmi(data)
    } catch (e) { console.error('[YanuX Skeletron] Coordinator Initialization Error:', e); }
}

/**
 * Event handler for "subscribeResource"
 * 
 * When we receive updated state data from the currently subscribed to resource
 * we can just pass it to the "updateBmi" function and it will update the UI
 * of the application so that it is kept in sync with other devices.
 * 
 * @todo [TODO:] Possible Exercise or Explanation Needed. 
 * @param {any} data 
 * @param {String} eventType 
 */
function resourceSubscriptionHandler(data, eventType) {
    console.log('[YanuX Skeletron] Resource Subscriber Handler Data:', data, 'Event Type:', eventType);
    updateBmi(data);
}

/**
 * Event handler for "subscribeResources"
 * 
 * We we receive information that there was a change in the available resources
 * we can simply call/develop a helper method (e.g., "updateResources") that will keep
 * the YanuX Resource Management Element up-to-date with the "fresh" resources.
 * 
 * @todo [TODO:] Possible Exercise or Explanation Needed. 
 * @param {any} data 
 * @param {String} eventType 
 */
function resourcesSubscriptionHandler(data, eventType) {
    console.log('[YanuX Skeletron] Resources Subscriber Handler Data:', data, 'Event Type:', eventType);
    updateResources();
}

/**
 * Event handler for "subscribeResourceSubscription"
 * 
 * When we receive information that there was a change in the resource we are subscribed to,
 * we should call Coordinator's "selectResource" method to select a new resource.
 * 
 * We should ignore "removed" eventTypes. 
 * However, under normal circumstances they should (almost) never occur. 
 * @todo [TODO:] Possible Exercise or Explanation Needed. 
 * @param {any} data 
 * @param {String} eventType 
 */
async function resourceSubscriptionSubscriptionHandler(data, eventType) {
    console.log('[YanuX Skeletron] Resource Subscription Subscriber Handler Data:', data, 'Event Type:', eventType);
    if (eventType !== 'removed') {
        try {
            const resourceData = await coordinator.selectResource(resourceSubscriptionHandler, data.resource);
            updateBmi(resourceData, true);
        } catch (e) { console.error('[YanuX Skeeltron] Resource Subscription Subscriber Handler Error:', e); }
    }
}

/**
 * Event handler for "subscribeInstances"
 * 
 * Whenever there are changes in the available instances we should update
 * the distribution UI components. We can call/develop a helper method 
 * (e.g., "updateComponentsDistribution") that does this redistribution.
 * 
 * @todo [TODO:] Possible Exercise or Explanation Needed. 
 * @param {any} data 
 * @param {String} eventType 
 */
function proxemicsSubscriptionHandler(data, eventType) {
    console.log('[YanuX Skeletron] Proxemics Subscriber Handler Data:', data, 'Event Type:', eventType);
    updateComponentsDistribution();
}

/**
 * Event handler for "subscribeProxemics"
 * 
 * Similarly to instances, a change in the proxemic relationship of devices
 * may require a redistribution of UI components. Therefore, we can call/develop
 * a helper method (e.g., "updateComponentsDistribution") that does this redistribution.
 * 
 * @todo [TODO:] Possible Exercise or Explanation Needed. 
 * @param {any} data 
 * @param {String} eventType 
 */
function instancesSubscriptionHandler(data, eventType) {
    console.log('[YanuX Skeletron] Instances Subscription Handler Data:', data, 'Event Type:', eventType);
    updateComponentsDistribution();
}

/**
 * Helper method (e.g., "updateResources") that keeps the 
 * YanuX Resource Management Element up-to-date with the "fresh" resources.
 * 
 * [TODO:] Possible Exercise or Explanation Needed. 
 */
async function updateResources() {
    console.log('[YanuX Skeletron] Updating Resources');
    try {
        /**
         * We first get the most up-to-date resources.
         */
        const resources = await coordinator.getResources();
        console.log('[YanuX Skeletron] Resources:', resources);
        /**
         * Then we get the YanuX Resource Management Element using its id.
         * We can then set its userId, resources and selectedResourceId properties
         * so that it displays an up-to-date view of the available resources.
         */
        const resourceManagementElement = document.getElementById('yxrm');
        resourceManagementElement.userId = coordinator.user.id;
        resourceManagementElement.resources = resources;
        resourceManagementElement.selectedResourceId = coordinator.subscribedResourceId;
    } catch (e) { console.error('[YanuX Skeletron] Error Retrieving Resources:', e); }
}

/**
 * We can call/develop a helper method (e.g., "updateComponentsDistribution") that
 * redistributes that UI components according to our restrictions by using the 
 * ComponentsRuleEngine. Thankfully, the Coordinator provides a helpful method 
 * (i.e., "updateComponentsDistribution") that does most of the work for us.
 * 
 * [TODO:] Possible Exercise or Explanation Needed. 
 */
function updateComponentsDistribution() {
    const componentsDistributionElement = document.getElementById('yxcd');
    coordinator.updateComponentsDistribution(componentsDistributionElement, componentsRuleEngine,
        false, coordinator.instance.id, configureComponents);
}

/**
 * This function receives an object that indicates which components should be displayed.
 * Based on that information, it can then change the CSS display property of the corresponding
 * HTML elements to show/hide them.
 * 
 * [TODO:] Possible Exercise or Explanation Needed. 
 * @param {ComponentsDistribution} componentsConfig 
 */
function configureComponents(componentsConfig) {
    const displayDisplay = componentsConfig.components && componentsConfig.components.Display === true ? 'block' : 'none';
    const formDisplay = componentsConfig.components && componentsConfig.components.Form === true ? 'block' : 'none';
    document.getElementById('display').style.display = displayDisplay;
    document.getElementById('form').style.display = formDisplay;
    console.log('[YanuX Skeletron] Configure Components Display:', displayDisplay, 'Form:', formDisplay)
}

/**
 * Function that is called to initialize the YanuX Resource Management Element.
 * You should get the corresponding element by its Id, associate the event listener functions
 * for each of the supported events and call "updateResources" to make sure that it is
 * populated with the most up-to-date resources.
 * 
 * [TODO:] Possible Exercise or Explanation Needed. 
 */
function initYanuxResourceManagementElement() {
    console.log('[YanuX Skeletron] Initializing Resource Management Element');
    const resourceManagementElement = document.getElementById('yxrm');
    resourceManagementElement.addEventListener('resource-selected', resourceSelected);
    resourceManagementElement.addEventListener('create-resource', createResource);
    resourceManagementElement.addEventListener('rename-resource', renameResource);
    resourceManagementElement.addEventListener('delete-resource', deleteResource);
    resourceManagementElement.addEventListener('share-resource', shareResource);
    resourceManagementElement.addEventListener('unshare-resource', unshareResource);
    updateResources();
}

/**
 * Event listener for "resource-selected".
 * 
 * Called when the user selects a different resource.
 * The event contains information about the Id of the selected resource
 * (i.e., "e.detail.selectedResourceId"). The "selectResource" method
 * provided by the Coordinator can be used to select a new resource.
 * 
 * Afterwards, the returned data for the new resource can be passed to the
 * updateBmi function.
 * 
 * If any kind of error/exception is raised an alert can be shown to the user.
 * 
 * [TODO:] Possible Exercise or Explanation Needed. 
 * @param {CustomEvent} e 
 */
async function resourceSelected(e) {
    console.log('[YanuX Skeletron] Resource Selected:', e.detail);
    try {
        const data = await coordinator.selectResource(resourceSubscriptionHandler, e.detail.selectedResourceId);
        console.log('[YanuX Skeletron] Selected Resource Data:', data);
        await updateBmi(data);
    } catch (e) {
        console.error('[YanuX Skeletron] Error Selecting Resource:', e);
        alert('Error Selecting Resource', e.message);
    }
}

/**
 * Event listener for "create-resource".
 * 
 * Called when the user creates a new resource.
 * The event contains information about the name of the new resource
 * (i.e., "e.detail.resourceName"). The "createResource" method provided
 * by the Coordinator can be used to create a new resource.
 * 
 * Afterwards, the returned resource can be selected by using the "selectResource"
 * method provided by the Coordinator.
 * 
 * The returned data for the newly created and selected resource
 * can be passed to the updateBmi function using the reset flag 
 * to clear the current values from the form.
 * 
 * If any kind of error/exception is raised an alert can be shown to the user.
 * 
 * [TODO:] Possible Exercise or Explanation Needed. 
 * @param {CustomEvent} e 
 */
async function createResource(e) {
    console.log('[YanuX Skeletron] Create Resource:', e.detail);
    try {
        const resource = await coordinator.createResource(e.detail.resourceName);
        const data = await coordinator.selectResource(resourceSubscriptionHandler, resource.id);
        await updateBmi(data, true);
    } catch (e) {
        console.error('[YanuX Skeletron] Error Creating Resource:', e);
        alert('Error Creating Resource', e.message);
    }
}

/**
 * Event listener for "rename-resource".
 * 
 * Called when the user renames a new resource.
 * The event contains information about the new name of the resource
 * (i.e., "e.detail.resourceName") and its Id (i.e., "e.detail.resourceId").
 * The "renameResource" method provided by the Coordinator can be used to rename a resource.
 * 
 * If any kind of error/exception is raised an alert can be shown to the user.
 * 
 * [TODO:] Possible Exercise or Explanation Needed. 
 * @param {CustomEvent} e 
 */
async function renameResource(e) {
    console.log('[YanuX Skeletron] Rename Resource:', e.detail);
    try {
        await coordinator.renameResource(e.detail.resourceName, e.detail.resourceId);
    } catch (e) {
        console.error('[YanuX Skeletron] Error Renaming Resource:', e);
        alert('Error Renaming Resource', e.message);
    }
}

/**
 * Event listener for "delete-resource".
 * 
 * Called when the user deletes a resource.
 * The event contains information about the Id of the resource to delete
 * (i.e., "e.detail.resourceId"). The "deleteResource" method provided by the
 * Coordinator can be used to delete a resource.
 * 
 * Afterwards, the default resource should be selected using the "selectResource"
 * method provided by Coordinator. The "updateBmi" function should be called with
 * the returned data.
 * 
 * If any kind of error/exception is raised an alert can be shown to the user.
 * 
 * [TODO:] Possible Exercise or Explanation Needed. 
 * @param {CustomEvent} e 
 */
async function deleteResource(e) {
    console.log('[YanuX Skeletron] Delete Resource:', e.detail);
    try {
        await coordinator.deleteResource(e.detail.resourceId);
        const data = await coordinator.selectResource(resourceSubscriptionHandler, coordinator.resource.id);
        await updateBmi(data);
    } catch (e) {
        console.error('[YanuX Skeletron] Error Deleting Resource:', e);
        alert('Error Deleting Resource', e.message);
    }
}

/**
 * Event listener for "share-resource".
 * 
 * Called when the user shares a resource.
 * 
 * The event contains information about the email of the user with whom
 * the resource was shared (i.e., "e.detail.userEmail") and its Id (i.e., "e.detail.resourceId").
 * 
 * The "shareResource" method provided by the Coordinator can be used to share a resource.
 * 
 * If any kind of error/exception is raised an alert can be shown to the user.
 * 
 * [TODO:] Possible Exercise or Explanation Needed. 
 * @param {CustomEvent} e 
 */
async function shareResource(e) {
    console.log('[YanuX Skeletron] Share Resource:', e.detail);
    try {
        await coordinator.shareResource(e.detail.userEmail, e.detail.resourceId);
    } catch (e) {
        console.error('[YanuX Skeletron] Error Sharing Resource:', e);
        alert('Error Sharing Resource', e.message);
    }
}

/**
 * Event listener for "unshare-resource".
 * 
 * Called when the user unshares a resource.
 * 
 * The event contains information about the email of the user with whom
 * the resource was shared (i.e., "e.detail.userEmail") and its Id (i.e., "e.detail.resourceId").
 * 
 * The "unshareResource" method provided by the Coordinator can be used to unshare a resource.
 * 
 * If any kind of error/exception is raised an alert can be shown to the user.
 * 
 * [TODO:] Possible Exercise or Explanation Needed. 
 * @param {CustomEvent} e 
 */
async function unshareResource(e) {
    console.log('[YanuX Skeletron] Unshare Resource:', e.detail);
    try {
        await coordinator.unshareResource(e.detail.userEmail, e.detail.resourceId);
    } catch (e) {
        console.error('[YanuX Skeletron] Error Unsharing Resource:', e);
        alert('Error Unsharing Resource', e.message);
    }
}

/**
 * Function that is called to initialize the YanuX Components Distribution Element.
 * You should get the corresponding element by its Id, associate the event listener functions
 * for each of the supported events and call "updateComponentsDistribution" to make sure that it is
 * populated with the most up-to-date distribution of UI components.
 * 
 * [TODO:] Possible Exercise or Explanation Needed. 
 */
function initYanuxComponentsDistributionElement() {
    console.log('[YanuX Skeletron] Initializing Components Distribution Element')
    const componentsDistributionElement = document.getElementById('yxcd');
    componentsDistributionElement.addEventListener('updated-components-distribution', updatedComponentsDistribution);
    componentsDistributionElement.addEventListener('reset-auto-components-distribution', resetAutoComponentsDistribution);
    updateComponentsDistribution()
}

/**
 * Function that is called whenever the user clicks on one of the checkboxes of the
 * YanuX Components Distribution Element. The Coordinator provides a useful method
 * (i.e., "distributeComponents") that receives the event and automatically deals 
 * with setting the new distribution. 
 * 
 * Assuming that you listening and reacting to changes made to the distribution 
 * of UI components, this will propagate across all application instances.
 * 
 * @param {CustomEvent} e 
 */
function updatedComponentsDistribution(e) {
    console.log('[YanuX Skeletron] Updating Components Distribution:', e.detail);
    coordinator.distributeComponents(e);
}

/**
 * Function that is called whenever the user clicks on one of the checkboxes of the
 * YanuX Components Distribution Element. The Coordinator provides a useful method
 * (i.e., "clearComponentsDistribution") that receives the event and automatically 
 * deals with clearing the current distribution. 
 * 
 * Assuming that you listening and reacting to changes made to the distribution 
 * of UI components, this will propagate across all application instances.
 * 
 * @param {CustomEvent} e 
 */
function resetAutoComponentsDistribution(e) {
    console.log('[YanuX Skeletron] Resetting Auto Components Distribution:', e.detail);
    coordinator.clearComponentsDistribution(e);
}
