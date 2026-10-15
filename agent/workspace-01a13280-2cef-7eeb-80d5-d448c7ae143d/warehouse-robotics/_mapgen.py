def grid(W, H):
    return [['.'] * W for _ in range(H)]

def box(g):
    H = len(g); W = len(g[0])
    for x in range(W):
        g[0][x] = '#'; g[H - 1][x] = '#'
    for y in range(H):
        g[y][0] = '#'; g[y][W - 1] = '#'

def rows(g):
    return [''.join(r) for r in g]

# STARTER 24 x 11
g = grid(24, 11); box(g)
g[1][1] = 'C'; g[1][7] = 'P'; g[1][13] = 'D'; g[1][22] = 'C'
for x in range(3, 22, 2):
    g[3][x] = 'S'; g[6][x] = 'S'
g[9][1] = 'r'; g[9][7] = 'r'; g[9][13] = 'r'; g[9][18] = 'R'
starter = rows(g)

# MID-MARKET 30 x 18
g = grid(30, 18); box(g)
g[1][1] = 'C'; g[1][8] = 'P'; g[1][14] = 'C'; g[1][21] = 'P'; g[1][28] = 'D'
for x in range(3, 27, 2):
    g[3][x] = 'S'; g[5][x] = 'S'
for x in range(2, 28):
    if x not in (14, 15):
        g[7][x] = '#'
for x in range(3, 27, 2):
    g[9][x] = 'S'; g[11][x] = 'S'
g[13][8] = 'P'; g[13][21] = 'P'
g[14][1] = 'C'; g[14][28] = 'C'; g[15][14] = 'R'
g[6][28] = 'D'
for x in (3, 10, 17, 24):
    g[16][x] = 'r'
g[12][1] = 'r'
mid = rows(g)

# MEGAHUB 36 x 22
g = grid(36, 22); box(g)
for x in (6, 15, 20, 29):
    g[2][x] = 'P'
for x in (6, 15, 20, 29):
    g[20][x] = 'P'
g[1][2] = 'C'; g[1][33] = 'C'; g[20][2] = 'C'; g[20][33] = 'C'; g[10][17] = 'C'
g[10][1] = 'D'; g[10][34] = 'D'
g[21][17] = 'R'
for x in range(4, 32, 2):
    g[5][x] = 'S'; g[7][x] = 'S'
    g[14][x] = 'S'; g[16][x] = 'S'
for x in range(3, 33):
    if x not in (9, 10, 25, 26):
        g[11][x] = '#'
for x in (4, 9, 14, 22, 27, 31):
    g[18][x] = 'r'
g[12][24] = 'r'; g[12][12] = 'r'
mega = rows(g)

for name, m in (('starter', starter), ('mid', mid), ('mega', mega)):
    lens = set(len(r) for r in m)
    print(name, len(m), lens)
    for r in m:
        print('"' + r + '",')
