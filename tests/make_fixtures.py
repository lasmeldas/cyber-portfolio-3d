import json, random, sys
sys.path.insert(0, '/home/claude/passguard'); sys.path.insert(0, '/home/claude/authwatch')
from passguard.core import analyze
from authwatch.parser import parse_lines
from authwatch.detector import detect
pw = ["", "a", "password", "Password1", "p@ssw0rd", "qwerty", "abcdef", "aaaaaaaa", "Tr0ub4dor&3", "correct horse battery staple",
      "hello2024", "12345678", "ZZZ111zzz", "Summer2019!", "letmein123", "qazwsx", "héllo wörld", "日本語パスワード", "x"*40, "Xk9#mQ2$vL7@pR4!",
      "P@ssw0rd!!!", "iloveyou2020", "asdfghjkl", "987654321", "mnbvcxz", "  spaces here ", "monkey", "monkey!", "Dragon1", "football99", "abc", "abcd1234"]
rnd = random.Random(7)
alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+"
for _ in range(120):
    pw.append("".join(rnd.choice(alpha) for _ in range(rnd.randint(1, 24))))
passwords = [{"input": p, "result": {k: v for k, v in analyze(p).to_dict().items() if k != "breach_count"}} for p in pw]
def run_log(text, year, **kw):
    ev = list(parse_lines(text.splitlines(True), year))
    return [a.to_dict() for a in detect(ev, **kw)]
logs = []
sample = open('/home/claude/authwatch/samples/auth.log').read()
logs.append({"text": sample, "year": 2026, "opts": {}, "alerts": run_log(sample, 2026)})
logs.append({"text": sample, "year": 2026, "opts": {"threshold": 3, "window": 60, "spray_users": 3}, "alerts": run_log(sample, 2026, threshold=3, window=60, spray_users=3)})
# random logs
users = ["root", "admin", "ubuntu", "git", "test", "oracle", "bob", "alice"]
for n in range(25):
    lines = []; t = 1000
    for _ in range(rnd.randint(5, 60)):
        t += rnd.choice([1, 2, 3, 5, 30, 120, 700])
        ip = rnd.choice(["203.0.113.5", "198.51.100.9", "192.0.2.77", "2001:db8::1"])
        u = rnd.choice(users); mon = "Nov"; day = 8 + t // 86400; hh = (t % 86400) // 3600; mm = (t % 3600) // 60; ss = t % 60
        ts = f"{mon} {day:>2} {hh:02d}:{mm:02d}:{ss:02d}"
        if rnd.random() < 0.8: lines.append(f"{ts} h sshd[1]: Failed password for {'invalid user ' if rnd.random()<.4 else ''}{u} from {ip} port 22 ssh2")
        else: lines.append(f"{ts} h sshd[1]: Accepted password for {u} from {ip} port 22 ssh2")
        if rnd.random() < 0.1: lines.append(f"{ts} h CRON[2]: noise line")
    text = "\n".join(lines) + "\n"
    opts = rnd.choice([{}, {"threshold": 3}, {"window": 30, "spray_users": 2}])
    logs.append({"text": text, "year": 2026, "opts": opts, "alerts": run_log(text, 2026, **opts)})
logs.append({"text": "Feb 30 10:00:00 h sshd[1]: Failed password for root from 1.2.3.4 port 1 ssh2\n", "year": 2026, "opts": {}, "alerts": run_log("Feb 30 10:00:00 h sshd[1]: Failed password for root from 1.2.3.4 port 1 ssh2\n", 2026)})
json.dump({"passwords": passwords, "logs": logs}, open('/home/claude/cyber-portfolio-3d/tests/fixtures.json', 'w'), ensure_ascii=False, indent=1)
print(len(passwords), len(logs), sum(len(l["alerts"]) for l in logs))

# k-NN fixtures from the real ml-from-scratch implementation
sys.path.insert(0, '/home/claude/ml-from-scratch')
import numpy as np
from mlscratch.neighbors import KNeighborsClassifier
knn = []
r = np.random.default_rng(3)
for case in range(12):
    n = int(r.integers(6, 40)); k = int(r.integers(1, 8)); ncls = int(r.integers(2, 4))
    X = np.round(r.uniform(0, 10, (n, 2)), 1); y = r.integers(0, ncls, n)
    if len(set(y.tolist())) < 2: y[0] = 0; y[1] = 1
    Q = np.round(r.uniform(0, 10, (15, 2)), 1)
    pred = KNeighborsClassifier(n_neighbors=min(k, n)).fit(X, y).predict(Q)
    knn.append({"X": X.tolist(), "y": y.tolist(), "k": k, "Q": Q.tolist(), "pred": pred.tolist()})
d = json.load(open('/home/claude/cyber-portfolio-3d/tests/fixtures.json')); d["knn"] = knn
json.dump(d, open('/home/claude/cyber-portfolio-3d/tests/fixtures.json', 'w'), ensure_ascii=False, indent=1)
print("knn cases", len(knn))
