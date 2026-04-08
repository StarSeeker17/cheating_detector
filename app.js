// 1. Initialize Data Structure
const sessionData = {
    metadata: {
        startTime: Date.now(),
        endTime: null,
        group: "honest"
    },
    events: {
        keystrokes: [],
        pastes: [],
        focusChanges: [],
        executions: [] 
    },
    finalCode: ""
};

// Grab the token from the URL (e.g., ?token=abc-123)
const urlParams = new URLSearchParams(window.location.search);
const userToken = urlParams.get('token');
let editor;

// If there is no token in the URL, warn the user and stop
if (!userToken) {
    showToast("CRITICAL ERROR: No access token found in the URL. Your data will not be saved.", "error");
} else {
    // Attach the token to the payload so the server can read it
    sessionData.metadata.token = userToken;
}

// NEW: Custom Toast Notification System
function showToast(message, type = "success") {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    
    toastContainer.appendChild(toast);
    
    // Automatically remove it from the DOM after 4 seconds
    setTimeout(() => {
        if (toastContainer.contains(toast)) {
            toast.remove();
        }
    }, 4000);
}

// 2. Load Monaco Editor
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: '# Challenge: Write a function named "reverse_string"\n\ndef reverse_string(s):\n    # Write your logic here\n    pass',
        language: 'python',
        theme: 'vs-dark'
    });
    // Make Monaco strictly obey the boundaries of its flexbox container
    window.addEventListener('resize', () => {
        if (editor) {
            editor.layout();
        }
    });
    attachTelemetryListeners(editor);
});

// 3. Telemetry Listeners
function attachTelemetryListeners(editor) {
    editor.onKeyDown((e) => sessionData.events.keystrokes.push({ key: e.browserEvent.key, timestamp: Date.now() }));
    editor.onDidPaste((e) => sessionData.events.pastes.push({ timestamp: Date.now(), characterCount: editor.getModel().getValueInRange(e.range).length }));
    window.addEventListener('blur', () => sessionData.events.focusChanges.push({ state: 'lost_focus', timestamp: Date.now() }));
    window.addEventListener('focus', () => sessionData.events.focusChanges.push({ state: 'gained_focus', timestamp: Date.now() }));

    // Handle "Run Code" Button
    document.getElementById('run-btn').addEventListener('click', () => {
        runUnitTestsSecurely(editor.getValue());
    });

    // Modal DOM Elements
    const submitModal = document.getElementById('submit-modal');
    const btnCancel = document.getElementById('modal-cancel');
    const btnConfirm = document.getElementById('modal-confirm');

    // 1. Open the Modal when "Finish & Submit" is clicked
    document.getElementById('submit-btn').addEventListener('click', () => {
        submitModal.classList.remove('hidden');
    });

    // 2. Close the Modal if they click "Cancel"
    btnCancel.addEventListener('click', () => {
        submitModal.classList.add('hidden');
    });

    // 3. Handle the Final Submission
    btnConfirm.addEventListener('click', async (e) => {
        const btn = e.target;
        
        // UI Update: Show loading state so they don't click twice
        btn.disabled = true;
        btn.innerText = "Uploading Data...";
        btnCancel.disabled = true;

        // Stop auto-saves and finalize metadata
        clearInterval(autoSaveInterval); 
        sessionData.metadata.group = document.getElementById('experiment-group').value;
        sessionData.metadata.endTime = Date.now();
        
        // Save to PythonAnywhere
        await saveProgressToServer("final");
        
        // Redirect to the final page
        window.location.href = "thank_you.html";
    });
}

// 4. Secure Python Test Runner
function runUnitTestsSecurely(userCode) {
    const consoleDiv = document.getElementById('console-output');
    consoleDiv.innerHTML = ""; 
    appendLog(consoleDiv, "Booting Python environment (this takes a second)...", "normal");

    let executionRecord = { timestamp: Date.now(), status: "pending", testsPassed: 0, errorMsg: null };

    // Notice the escaped backticks (\`) around the Python code below
    const workerLogic = `
        importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

        self.onmessage = async function(e) {
            const userCode = e.data.code;
            
            try {
                let pyodide = await loadPyodide();
                
                const testRunnerCode = \`
test_cases = [
    ("hello", "olleh"),
    ("cyber", "rebyc"),
    ("12345", "54321")
]
passed = 0
results = []

for input_val, expected in test_cases:
    try:
        actual = reverse_string(input_val)
        if actual == expected:
            passed += 1
            results.append({"status": "PASS", "expected": expected, "got": actual})
        else:
            results.append({"status": "FAIL", "expected": expected, "got": actual})
    except Exception as ex:
        results.append({"status": "ERROR", "expected": expected, "got": str(ex)})

{"passed": passed, "total": len(test_cases), "details": results}
\`;
                
                const finalCode = userCode + "\\n" + testRunnerCode;
                let resultProxy = await pyodide.runPythonAsync(finalCode);
                let result = resultProxy.toJs({dict_converter: Object.fromEntries});
                
                // Send the exact properties the listener expects
                self.postMessage({ success: true, passed: result.passed, total: result.total, details: result.details });
                
            } catch (err) {
                self.postMessage({ success: false, error: err.message });
            }
        };
    `;

    const blob = new Blob([workerLogic], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    // Increased timeout to 5 seconds because Pyodide can take 1-2 seconds to load on first click
    const timeout = setTimeout(() => {
        worker.terminate(); 
        executionRecord.status = "timeout";
        executionRecord.errorMsg = "Execution timed out (Possible infinite loop).";
        appendLog(consoleDiv, "[ERROR] Execution timed out.", "fail");
        sessionData.events.executions.push(executionRecord);
    }, 5000); 

    worker.onmessage = function(e) {
        clearTimeout(timeout); 
        const data = e.data;

        if (data.success) {
            executionRecord.status = "success";
            executionRecord.testsPassed = data.passed;
            data.details.forEach(res => {
                const colorClass = res.status === "PASS" ? "pass" : "fail";
                appendLog(consoleDiv, `[\${res.status}] Test \${res.test}: expected "\${res.expected}", got "\${res.got}"`, colorClass);
            });
            appendLog(consoleDiv, `\\nTotal: \${data.passed}/\${data.total} tests passed.`, "normal");
        } else {
            executionRecord.status = "error";
            executionRecord.errorMsg = data.error;
            appendLog(consoleDiv, `[ERROR] \${data.error}`, "fail");
        }
        
        sessionData.events.executions.push(executionRecord);
        worker.terminate(); 
    };

    worker.postMessage({ code: userCode });
}

// 5. Safe HTML Logger
function appendLog(container, message, typeClass) {
    const span = document.createElement('span');
    span.textContent = message; 
    if (typeClass) span.className = typeClass;
    container.appendChild(span);
    container.appendChild(document.createElement('br'));
}

// 6. NEW: The Missing Export Function
async function exportData(finalCodeText) {
    sessionData.metadata.endTime = Date.now();
    sessionData.finalCode = finalCodeText;

    // Change this to your live server URL later
    const SERVER_URL = "https://timisoreanul.pythonanywhere.com/api/submit-telemetry"; 

    try {
        const response = await fetch(SERVER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(sessionData)
        });

        if (response.ok) {
            showToast("Submission complete! Data securely sent.", "success");
        } else {
            console.error("Server responded with an error:", response.status);
            showToast("Failed to send data. Please check your connection.", "error");
        }
    } catch (error) {
        console.error("Network error:", error);
        showToast("Could not connect to the server. (Make sure your Flask server is running!)", "error");
    }
}

// Add a status flag to your metadata
sessionData.metadata.status = "in-progress";

// 1. Periodic Auto-Save (Every 60 seconds)
const autoSaveInterval = setInterval(() => {
    saveProgressToServer("auto-save");
}, 60000); // 60,000 ms = 1 minute

// 2. Tab Close / Unload Event Handler
// visibilitychange is the most reliable modern event for detecting tab closure or switching away
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        // We log the end time just in case they never come back
        sessionData.metadata.endTime = Date.now(); 
        saveProgressToServer("auto-save", true);
    }
});

// 3. The Core Save Function
async function saveProgressToServer(type, isClosing = false) {
    sessionData.metadata.status = type; // "auto-save" or "final"
    sessionData.finalCode = editor.getValue(); // Grab the current code state

    const SERVER_URL = "https://timisoreanul.pythonanywhere.com/api/submit-telemetry";

    try {
        // The 'keepalive: true' flag is CRITICAL here. 
        // It tells the browser: "Even if the tab closes, finish sending this POST request in the background."
        await fetch(SERVER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sessionData),
            keepalive: isClosing 
        });
        
        if (type === "auto-save" && !isClosing) {
            console.log("Auto-save successful at " + new Date().toLocaleTimeString());
        }
    } catch (error) {
        console.error("Auto-save failed:", error);
    }
}

// 4. Update your existing Submit Button Listener
document.getElementById('submit-btn').addEventListener('click', async () => {
    clearInterval(autoSaveInterval); // Stop the auto-saver
    sessionData.metadata.group = document.getElementById('experiment-group').value;
    sessionData.metadata.endTime = Date.now();
    
    // Call the save function with the "final" flag
    await saveProgressToServer("final");
    
    showToast("Submission complete! Thank you for participating.", "success");
    
    // Optional: Redirect them to a "Thank You" page so they don't click submit twice
    // window.location.href = "thank_you.html";
});