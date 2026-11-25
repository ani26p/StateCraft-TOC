import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from automata import AutomataError, NFA, convert_nfa_to_dfa, simulate_dfa, simulate_nfa

EXAMPLE = {
    "states": ["q0", "q1", "q2"], "alphabet": ["0", "1"], "start": "q0", "accept": ["q2"],
    "transitions": {"q0": {"0": ["q0", "q1"], "1": ["q0"]}, "q1": {"0": [], "1": ["q2"]}, "q2": {"0": [], "1": []}},
}

class ConverterTests(unittest.TestCase):
    def test_subset_construction_reachable_states_and_total_rows(self):
        dfa = convert_nfa_to_dfa(EXAMPLE)
        self.assertEqual(dfa["states"][0], "{q0}")
        self.assertIn("{q0, q1}", dfa["states"])
        self.assertEqual(set(dfa["transitions"]), set(dfa["states"]))
        self.assertTrue(all(set(row) == set(EXAMPLE["alphabet"]) for row in dfa["transitions"].values()))
        self.assertNotIn("∅", dfa["states"])  # Empty subset is omitted when it is unreachable.

    def test_empty_subset_is_generated_when_reachable(self):
        data = {"states": ["s"], "alphabet": ["a"], "start": "s", "accept": [], "transitions": {"s": {"a": []}}}
        dfa = convert_nfa_to_dfa(data)
        self.assertIn("∅", dfa["states"])
        self.assertEqual(dfa["transitions"]["∅"]["a"], "∅")

    def test_nfa_and_dfa_acceptance_match(self):
        dfa = convert_nfa_to_dfa(EXAMPLE)
        for word, expected in [("", False), ("0", False), ("01", True), ("101", True), ("1100", False)]:
            with self.subTest(word=word):
                self.assertEqual(simulate_nfa(EXAMPLE, word)["accepted"], expected)
                self.assertEqual(simulate_dfa(dfa, word)["accepted"], expected)

    def test_unknown_input_symbol_rejected(self):
        with self.assertRaises(AutomataError):
            simulate_dfa(convert_nfa_to_dfa(EXAMPLE), "2")

    def test_rejects_epsilon_transition(self):
        data = dict(EXAMPLE)
        data["transitions"] = {**EXAMPLE["transitions"], "q0": {**EXAMPLE["transitions"]["q0"], "ε": ["q1"]}}
        with self.assertRaisesRegex(AutomataError, "ε transitions"):
            NFA.from_dict(data)

    def test_invalid_destination_rejected(self):
        data = dict(EXAMPLE)
        data["transitions"] = {**EXAMPLE["transitions"], "q0": {"0": ["missing"], "1": []}}
        with self.assertRaisesRegex(AutomataError, "destination"):
            NFA.from_dict(data)

if __name__ == "__main__":
    unittest.main()
