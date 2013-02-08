#!/bin/sh
# this assumes a 1/32" endmill (0.79375 mm)
# size is 60x45 mm

rm testpattern-*.rml 2>/dev/null

../bin/png_path testpattern.png testpattern-a1.path 1.1 0.79375 -1 0.5
../bin/path_rml testpattern-a1.path testpattern-a1.rml 4 0 0 -0.275
../bin/png_path testpattern.png testpattern-a2.path 1.1 0.79375 -1 0.6
../bin/path_rml testpattern-a2.path testpattern-a2.rml 4 15 0 -0.275
../bin/png_path testpattern.png testpattern-a3.path 1.1 0.79375 -1 0.7
../bin/path_rml testpattern-a3.path testpattern-a3.rml 4 30 0 -0.275
../bin/png_path testpattern.png testpattern-a4.path 1.1 0.79375 -1 0.8
../bin/path_rml testpattern-a4.path testpattern-a4.rml 4 45 0 -0.275

../bin/png_path testpattern.png testpattern-b1.path 1.1 0.79375 -1 0.5
../bin/path_rml testpattern-b1.path testpattern-b1.rml 4 0 15 -0.3
../bin/png_path testpattern.png testpattern-b2.path 1.1 0.79375 -1 0.6
../bin/path_rml testpattern-b2.path testpattern-b2.rml 4 15 15 -0.3
../bin/png_path testpattern.png testpattern-b3.path 1.1 0.79375 -1 0.7
../bin/path_rml testpattern-b3.path testpattern-b3.rml 4 30 15 -0.3
../bin/png_path testpattern.png testpattern-b4.path 1.1 0.79375 -1 0.8
../bin/path_rml testpattern-b4.path testpattern-b4.rml 4 45 15 -0.3

../bin/png_path testpattern.png testpattern-c1.path 1.1 0.79375 -1 0.5
../bin/path_rml testpattern-c1.path testpattern-c1.rml 4 0 30 -0.325
../bin/png_path testpattern.png testpattern-c2.path 1.1 0.79375 -1 0.6
../bin/path_rml testpattern-c2.path testpattern-c2.rml 4 15 30 -0.325
../bin/png_path testpattern.png testpattern-c3.path 1.1 0.79375 -1 0.7
../bin/path_rml testpattern-c3.path testpattern-c3.rml 4 30 30 -0.325
# we could concatenate here and filter all the MC0 and H commands
../bin/png_path testpattern.png testpattern-c4.path 1.1 0.79375 -1 0.8
../bin/path_rml testpattern-c4.path testpattern-c4.rml 4 45 30 -0.325

cat testpattern-*.rml > testpattern.rml

rm testpattern-*.path 2>/dev/null
rm testpattern-*.rml 2>/dev/null
