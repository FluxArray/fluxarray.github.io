---
title: String Hashing
date: 30-03-2026
tags: [hashing, Rabin-Karp, string]
---
String hash is basically a function for which the following condition should hold:-

==if 2 strings s, t are equal then their hashes also have to be equal.==

When we want to compare 2 strings the brute force method is just to compare the letter one by one which has a time complexity of $O(min(n1, n2))$. We can do better, the idea for string hashing we map the strings to a number and compare those instead.

like for ex:- the base 10 itself 
$1234 > 123$ how do we know this, it is because we are just $1234$ has a extra number $1$ at the start making it the number being added by $1000$ which increase the numbers value just like that we can assign the values to the letters.

We also
So in simple terms:

```
a - 1;
b - 2;
.
.
.
z - 26;
```

So a string can visualized like a number in base 26.
two number in binary isn't same
just like that we could make it such that two strings in base $26$ isn't same.

So how do we check it like:-
for binary we just do this 
$213$ and $123$ are not equal cause

$213 = 100*2 + 10*1 + 3$ 
$123 = 100 * 1 + 10 * 2 + 3$

so here the number is basically in base 10 comparison.
So the formula is basically
Summation i -> n-1 (di * 10^i)

For string we could also do the same 
by taking a base greater than 26
so something like 

=='ab'== = $1*26 + 2*26^0$

but 26 is not used cause 26 is not a prime as when hashing there are more chances for there to be a collision so we use a prime which is greater than 26 for example 31

=='abc'== = $1 * 31^2 + 2 * 31^1 + 3*31^0$

but since this could not be stored in integer we could just as in a string which is has a length 10 it will be a problem for overflow (ie: $31^9$) so we use modulo operator which does this basically:
$n$ % $m$ where $m = 10e9 + 7$
So basically
![[Pastedimage20260330214138.png]]

this is used widely.
It's called **polynomial rolling hash function**

The probability for collision is low and is equal to $1/m$ which is $10^-9$

the code for this hashing is this
```cpp
long long compute_hash(string const& s) {
    const int p = 31;
    const int m = 1e9 + 9;
    long long hash_value = 0;
    long long p_pow = 1;
    for (char c : s) {
        hash_value = (hash_value + (c - 'a' + 1) * p_pow) % m;
        p_pow = (p_pow * p) % m; //precompute this shit so it's faster
    }
    return hash_value;
}
```
==p will be 53 in case for both uppercase and lowercase letters are there==

### fast calculation of a substring of a given string
Given a string s and indices i and j, find the hash of the substring $s[i...j]$
then we have

![[Pastedimage20260331101827.png]]
multiply this by $p^i$ then we have this thing
![[Pastedimage20260331102228.png|heheboi]]
so for finding $hash(s[i...j])$ we have to divide it by $p^i$ in the final equation => we have to take modular inverse $p^i$.
But there is a much easier method to do that we just multiply the hash by some power of p which it's missing.

Suppose we have two hashes of two substrings, one multiplied by  $p^i$  and the other by  $p^j$ . If  $i < j$  then we multiply the first hash by  $p^{j-i}$ , otherwise, we multiply the second hash by  $p^{i-j}$ .

basically:-
To safely compare $Hash(s[i...j])$ with another hash, we multiply it by $P^(N-1-i)$.
as if they were shifted to the end of a string of length N, avoiding the need for expensive modular inverse calculations.
## Rabin-Karp Algorithm for string matching
Given two strings - a pattern s and a text t, determine if the pattern appears in the text and if it does, print all its occurrences in $O(|s| + |t|)$ 
solution - It's just sliding window with string hashing.
```cpp
vector<int> rabin_karp(string const& s, string const& t) {
    const int p = 31; 
    const int m = 1e9 + 9;
    int S = s.size(), T = t.size();

    vector<long long> p_pow(max(S, T)); 
    p_pow[0] = 1; 
    for (int i = 1; i < (int)p_pow.size(); i++) 
        p_pow[i] = (p_pow[i-1] * p) % m;

    vector<long long> h(T + 1, 0); 
    for (int i = 0; i < T; i++)
        h[i+1] = (h[i] + (t[i] - 'a' + 1) * p_pow[i]) % m; 
    long long h_s = 0; 
    for (int i = 0; i < S; i++) 
        h_s = (h_s + (s[i] - 'a' + 1) * p_pow[i]) % m; 

    vector<int> occurrences;
    for (int i = 0; i + S - 1 < T; i++) {
        long long cur_h = (h[i+S] + m - h[i]) % m;
        if (cur_h == h_s * p_pow[i] % m)
            occurrences.push_back(i);
    }
    return occurrences;
}
```

a double hashing could be done to decrease the probability of collision
something like this:-
```cpp
const int p1 = 31; 
const int p2 = 37;
const ll m1 = 1e9 + 7;
const ll m2 = 1e9 + 9;

vector<ll> p_pow1, p_pow2, h1, h2;

void precompute(const string& s) {
    int n = s.length();
    
    p_pow1.assign(n + 1, 1);
    p_pow2.assign(n + 1, 1);
    for (int i = 0; i < n; i++) {
        p_pow1[i+1] = (p_pow1[i] * p1) % m1;
        p_pow2[i+1] = (p_pow2[i] * p2) % m2;
    }

    h1.assign(n + 1, 0);
    h2.assign(n + 1, 0);
    for (int i = 0; i < n; i++) {
        h1[i+1] = (h1[i] + (s[i] - 'a' + 1) * p_pow1[i]) % m1;
        h2[i+1] = (h2[i] + (s[i] - 'a' + 1) * p_pow2[i]) % m2;
    }
}

void solve() {
    string s;
    cin >> s;
    precompute(s);
    int n = (int)s.length();

    string b;
    cin >> b;

    int k;
    cin >> k;

    map<char, int> mp;
    rep(i, 26) {
        if (b[i] == '1') {
            mp[(char)('a' + i)]++;
        }
    }

    vector<pair<ll, ll>> ans;
    for (int i = 0; i < n; i++) {
        for (int j = i; j < n; j++) {
            ll cur1 = (h1[j + 1] + m1 - h1[i]) % m1;
            cur1 = (cur1 * p_pow1[n - 1 - i]) % m1;
            
            ll cur2 = (h2[j + 1] + m2 - h2[i]) % m2;
            cur2 = (cur2 * p_pow2[n - 1 - i]) % m2;

            ans.push_back({cur1, cur2});
        }
    }

    sort(all(ans));
    ans.erase(unique(all(ans)), ans.end());

    cout << (int)ans.size() << '\n';
}
```

here we are comparing different substrings and print the number of unique substring in the string s.

Why do we need double hashing?
The Birthday Paradox states that you need roughly $\sqrt{M}$ items before a collision becomes highly probable.