console.log('[YanuX Skeletron] Initializing');
let bmiState = { weight: 0, height: 0, result: 0 }

function updateBmi() {
    console.log('[YanuX Skeletron] Update BMI');
    bmiState.weight = parseFloat(document.getElementById('weight').value);
    bmiState.height = parseFloat(document.getElementById('height').value);
    bmiState.result = bmiState.weight / Math.pow(bmiState.height, 2)
    if (isFinite(bmiState.result)) {
        document.getElementById('result').textContent = bmiState.result.toFixed(2);
    } else {
        document.getElementById('result').textContent = 'Invalid';
    }
    console.log('[YanuX Skeletron] BMI State', bmiState);
}
