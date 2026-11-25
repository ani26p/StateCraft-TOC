# StateCraft TOC

An interactive, educational NFA → DFA simulator. Build a standard NFA without ε-transitions, follow reachable-state subset construction, inspect its DFA diagram and table, and test strings in both machines.

## Requirements

- Windows 10 or 11
- Python 3.10 or newer, with **Add Python to PATH** enabled
- A modern browser with an internet connection for the Cytoscape.js diagram library and web fonts

## Run it on Windows

1. Extract the `AutomataForge` folder somewhere convenient.
2. Open that folder in VS Code (`File → Open Folder…`).
3. Double-click `run.bat` in File Explorer, or run `run.bat` from the VS Code terminal.
4. On first launch, the script creates a local `.venv`, installs Flask, opens `http://127.0.0.1:5000`, and starts the server. Keep the terminal window open while using the app.
5. To stop the app, focus the terminal and press **Ctrl+C**.

If Windows cannot find Python, install Python 3.10+ from python.org, enable **Add Python to PATH**, then reopen the terminal and run `run.bat` again. To run without the launcher:

```bat
py -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
python backend\app.py
```

Then visit `http://127.0.0.1:5000`.

## Use the simulator

1. Edit the alphabet, states, start state, accepting states, and transitions in **State builder**, or switch to **Transition table**. In the builder, use Ctrl-click (or ⌘-click) to select several destinations in one cell. A blank cell means no destinations.
2. Select **Convert NFA**. The DFA contains only reachable subsets, including the empty set when it is reachable. Each DFA row has a transition for every alphabet symbol.
3. Use **Previous**, **Next**, **Run**, and **Reset** to follow the conversion steps. Drag and zoom the diagram to explore it.
4. Enter a string and select **Test string** to compare NFA and DFA acceptance, then step through the run.

The empty string is entered as a blank input. Every alphabet symbol must be one character. ε-transitions, DFA → NFA conversion, and ε-NFAs are outside the core scope.

## Tests

From the project folder, run:

```bat
py -m unittest discover -s tests -v
```

The tests cover reachable subset construction, complete DFA rows, acceptance equivalence, invalid symbols, invalid destinations, and ε-transition rejection.

## Project layout

```text
AutomataForge/
├── backend/
│   ├── app.py
│   └── automata/engine.py
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── tests/test_converter.py
├── requirements.txt
└── run.bat
```
