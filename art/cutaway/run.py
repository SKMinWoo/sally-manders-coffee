"""Runs cutaway.py and writes any traceback to out_demo/error.txt (the launcher swallows stdout)."""
import os, traceback
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
err = os.path.join(HERE, "out", "error.txt")
try:
    p = os.path.join(HERE, "cutaway.py")
    exec(compile(open(p, encoding="utf-8").read(), p, "exec"), {"__file__": p, "__name__": "__main__"})
    if os.path.exists(err):
        os.remove(err)
except Exception:
    open(err, "w", encoding="utf-8").write(traceback.format_exc())
