// 1. Initialize Data Structure (Added 'executions')
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
        executions: [] // NEW: Tracks every time they hit "Run"
    },
    finalCode: ""
};

// 2. Load Monaco Editor (Pre-filled with the challenge)
require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' }});
require(['vs/editor/editor.main'], function() {
    const editor = monaco.editor.create(document.getElementById('editor-container'), {
        value: '/* \nChallenge: Write a function named "reverseString" that takes a string \nand returns it reversed. \n*/\n\nfunction reverseString(str) {\n    // Write your logic here\n    \n}',
        language: 'python',
        theme: 'vs-dark'
    });

    attachTelemetryListeners(editor);
});

// 3. Telemetry Listeners (Same as before)
function attachTelemetryListeners(editor) {
    editor.onKeyDown((e) => sessionData.events.keystrokes.push({ key: e.browserEvent.key, timestamp: Date.now() }));
    editor.onDidPaste((e) => sessionData.events.pastes.push({ timestamp: Date.now(), characterCount: editor.getModel().getValueInRange(e.range).length }));
    window.addEventListener('blur', () => sessionData.events.focusChanges.push({ state: 'lost_focus', timestamp: Date.now() }));
    window.addEventListener('focus', () => sessionData.events.focusChanges.push({ state: 'gained_focus', timestamp: Date.now() }));

    // NEW: Handle "Run Code" Button
    document.getElementById('run-btn').addEventListener('click', () => {
        runUnitTests(editor.getValue());
    });

    // Handle Submit
    document.getElementById('submit-btn').addEventListener('click', () => {
        sessionData.metadata.group = document.getElementById('experiment-group').value;
        exportData(editor.getValue()); // Or your fetch() function to the Python backend
    });
}

function runUnitTestsSecurely(userCode) {
    const consoleDiv = document.getElementById('console-output');
    consoleDiv.innerHTML = ""; // Clear previous
    appendLog(consoleDiv, "Running tests safely in an isolated worker...\n", "normal");

    let executionRecord = { timestamp: Date.now(), status: "pending", testsPassed: 0, errorMsg: null };

    // 1. Create the Worker Logic (This runs in total isolation)
    const workerLogic = `
    // 1. Import Pyodide into the background worker
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

    self.onmessage = async function(e) {
        const userCode = e.data.code;
        
        try {
            // 2. Load the Python environment
            let pyodide = await loadPyodide();
            
            // 3. Define the Python unit tests to append to the user's code
            const testRunnerCode = test_cases = [
                ("hello", "olleh"),
                ("cyber", "rebyc"),
                ("12345", "54321")
            ];
            let passed = 0;
            let results = [];

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

        # Return the results back to JavaScript as a dictionary
        {"passed": passed, "total": len(test_cases), "details": results};
            // 4. Execute the user's code + the test runner
            const finalCode = userCode + "\\n" + testRunnerCode;
            
            // runPythonAsync runs the code and returns the last evaluated expression
            let resultProxy = await pyodide.runPythonAsync(finalCode);
            
            // Convert Python dictionary back to JavaScript object
            let result = resultProxy.toJs({dict_converter: Object.fromEntries});
            
            self.postMessage({ success: true, data: result });
            
        } catch (err) {
            // Catch Python SyntaxErrors or IndentationErrors
            self.postMessage({ success: false, error: err.message });
        }
    };
`;

    // 2. Convert logic to a Blob and boot the Worker
    const blob = new Blob([workerLogic], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    // 3. Set a Timeout (The Anti-Infinite-Loop Defense)
    const timeout = setTimeout(() => {
        worker.terminate(); // Kill the worker forcefully
        executionRecord.status = "timeout";
        executionRecord.errorMsg = "Execution timed out (Possible infinite loop).";
        appendLog(consoleDiv, "[ERROR] Execution timed out.", "fail");
        sessionData.events.executions.push(executionRecord);
    }, 2000); // 2-second hard limit

    // 4. Handle messages coming back from the isolated worker
    worker.onmessage = function(e) {
        clearTimeout(timeout); // They finished before the timeout
        const data = e.data;

        if (data.success) {
            executionRecord.status = "success";
            executionRecord.testsPassed = data.passed;
            data.details.forEach(res => {
                const colorClass = res.status === "PASS" ? "pass" : "fail";
                appendLog(consoleDiv, `[${res.status}] Test ${res.test}: expected "${res.expected}", got "${res.got}"`, colorClass);
            });
            appendLog(consoleDiv, `\nTotal: ${data.passed}/${data.total} tests passed.`, "normal");
        } else {
            executionRecord.status = "error";
            executionRecord.errorMsg = data.error;
            appendLog(consoleDiv, `[ERROR] ${data.error}`, "fail");
        }
        
        sessionData.events.executions.push(executionRecord);
        worker.terminate(); // Clean up
    };

    // 5. Send the student's code to the isolated worker
    worker.postMessage({ code: userCode });
}

function appendLog(container, message, typeClass) {
    // Create a new span element
    const span = document.createElement('span');
    
    // Use textContent to completely neutralize XSS attacks
    span.textContent = message; 
    
    if (typeClass) span.className = typeClass;
    
    container.appendChild(span);
    container.appendChild(document.createElement('br'));
}