"""Validated NFA model and subset construction for NFAs without epsilon moves."""
from collections import deque
from dataclasses import dataclass

class AutomataError(ValueError):
    """An invalid automaton or simulation request."""

@dataclass
class NFA:
    states: list[str]
    alphabet: list[str]
    transitions: dict[str, dict[str, list[str]]]
    start: str
    accept: list[str]

    @classmethod
    def from_dict(cls, data):
        if not isinstance(data, dict):
            raise AutomataError("Provide an automaton object.")
        states, alphabet = data.get("states"), data.get("alphabet")
        if not isinstance(states, list) or not states or len(states) > 40:
            raise AutomataError("Add between 1 and 40 states.")
        if any(not isinstance(s, str) or not s.strip() for s in states) or len(set(states)) != len(states):
            raise AutomataError("State names must be unique, non-empty text.")
        if not isinstance(alphabet, list) or not alphabet or len(alphabet) > 12:
            raise AutomataError("Add between 1 and 12 input symbols.")
        if any(not isinstance(a, str) or len(a) != 1 or a.isspace() for a in alphabet) or len(set(alphabet)) != len(alphabet):
            raise AutomataError("Each alphabet symbol must be a unique, non-space character.")
        start, accept = data.get("start"), data.get("accept")
        if start not in states:
            raise AutomataError("Choose a start state from the state list.")
        if not isinstance(accept, list) or any(q not in states for q in accept):
            raise AutomataError("Every accepting state must be in the state list.")
        raw = data.get("transitions", {})
        if not isinstance(raw, dict):
            raise AutomataError("Transitions must be an object keyed by source state.")
        trans = {q: {a: [] for a in alphabet} for q in states}
        for source, by_symbol in raw.items():
            if source not in trans or not isinstance(by_symbol, dict):
                raise AutomataError(f"Unknown transition source: {source}.")
            for symbol, destinations in by_symbol.items():
                if symbol not in alphabet:
                    raise AutomataError(f"Transition symbol {symbol!r} is not in the alphabet. ε transitions are not supported.")
                if isinstance(destinations, str):
                    destinations = [destinations]
                if not isinstance(destinations, list) or any(d not in states for d in destinations):
                    raise AutomataError(f"Every destination from {source} on {symbol} must be a listed state.")
                trans[source][symbol] = list(dict.fromkeys(destinations))
        return cls(list(states), list(alphabet), trans, start, list(dict.fromkeys(accept)))

    def to_dict(self):
        return {"states": self.states, "alphabet": self.alphabet, "transitions": self.transitions, "start": self.start, "accept": self.accept}

def convert_nfa_to_dfa(nfa):
    """Return reachable subset states, a total transition table, and teaching steps."""
    if isinstance(nfa, dict):
        nfa = NFA.from_dict(nfa)
    start = frozenset([nfa.start])
    queue, subsets = deque([start]), [start]
    transitions, steps = {}, []
    while queue:
        subset = queue.popleft()
        label = _label(subset)
        transitions[label] = {}
        for symbol in nfa.alphabet:
            target = frozenset(dest for state in subset for dest in nfa.transitions[state][symbol])
            transitions[label][symbol] = _label(target)
            steps.append({"source": label, "symbol": symbol, "target": _label(target), "nfaSources": sorted(subset), "nfaTargets": sorted(target)})
            if target not in subsets:
                subsets.append(target)
                queue.append(target)
    names = [_label(s) for s in subsets]
    accepting = [_label(s) for s in subsets if set(s) & set(nfa.accept)]
    return {"states": names, "subsets": {_label(s): sorted(s) for s in subsets}, "alphabet": nfa.alphabet, "transitions": transitions, "start": _label(start), "accept": accepting, "steps": steps}

def _label(subset):
    return "∅" if not subset else "{" + ", ".join(sorted(subset)) + "}"

def simulate_dfa(dfa, text):
    if not isinstance(text, str):
        raise AutomataError("Enter a string to simulate.")
    unknown = [c for c in text if c not in dfa["alphabet"]]
    if unknown:
        raise AutomataError("Input contains symbols outside the alphabet: " + ", ".join(dict.fromkeys(unknown)))
    path = [dfa["start"]]
    for char in text:
        path.append(dfa["transitions"][path[-1]][char])
    return {"accepted": path[-1] in dfa["accept"], "path": path, "input": text}

def simulate_nfa(nfa, text):
    if isinstance(nfa, dict):
        nfa = NFA.from_dict(nfa)
    if any(c not in nfa.alphabet for c in text):
        raise AutomataError("Input contains symbols outside the alphabet.")
    current = {nfa.start}
    path = [sorted(current)]
    for c in text:
        current = {d for q in current for d in nfa.transitions[q][c]}
        path.append(sorted(current))
    return {"accepted": bool(current & set(nfa.accept)), "path": path, "input": text}
