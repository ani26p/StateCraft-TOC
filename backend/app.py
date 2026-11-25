from flask import Flask, jsonify, request, send_from_directory
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from automata import AutomataError, NFA, convert_nfa_to_dfa, simulate_dfa, simulate_nfa

app = Flask(__name__, static_folder=str(ROOT / "frontend"), static_url_path="")

@app.get("/")
def home():
    return send_from_directory(ROOT / "frontend", "index.html")

@app.get("/api/health")
def health():
    return jsonify({"ok": True, "name": "StateCraft TOC"})

@app.post("/api/nfa/validate")
def validate_nfa():
    try:
        return jsonify({"valid": True, "nfa": NFA.from_dict(request.get_json(force=True)).to_dict()})
    except AutomataError as error:
        return jsonify({"valid": False, "error": str(error)}), 400

@app.post("/api/nfa/convert")
def convert():
    try:
        return jsonify(convert_nfa_to_dfa(NFA.from_dict(request.get_json(force=True))))
    except (AutomataError, KeyError, TypeError) as error:
        return jsonify({"error": str(error)}), 400

@app.post("/api/simulate")
def simulate():
    try:
        body = request.get_json(force=True)
        nfa = NFA.from_dict(body.get("nfa"))
        dfa = convert_nfa_to_dfa(nfa)
        text = body.get("input", "")
        return jsonify({"nfa": simulate_nfa(nfa, text), "dfa": simulate_dfa(dfa, text)})
    except (AutomataError, TypeError, KeyError) as error:
        return jsonify({"error": str(error)}), 400

@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "That endpoint was not found."}), 404

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
