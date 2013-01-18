#!/bin/sh
# this assumes a 1/32" endmill (0.79375 mm)
# size is 60x45 mm

rm testpattern-*.rml 2>/dev/null

../bin/png_path testpattern.png testpattern-040-050.path 1.1 0.79375 -1 0.5
../bin/path_rml testpattern-040-050.path testpattern-040-050.rml 4 0 0 -0.4
../bin/png_path testpattern.png testpattern-040-060.path 1.1 0.79375 -1 0.6
../bin/path_rml testpattern-040-060.path testpattern-040-060.rml 4 15 0 -0.4
../bin/png_path testpattern.png testpattern-040-070.path 1.1 0.79375 -1 0.7
../bin/path_rml testpattern-040-070.path testpattern-040-070.rml 4 30 0 -0.4
../bin/png_path testpattern.png testpattern-040-080.path 1.1 0.79375 -1 0.8
../bin/path_rml testpattern-040-080.path testpattern-040-080.rml 4 45 0 -0.4

../bin/png_path testpattern.png testpattern-045-050.path 1.1 0.79375 -1 0.5
../bin/path_rml testpattern-045-050.path testpattern-045-050.rml 4 0 15 -0.45
../bin/png_path testpattern.png testpattern-045-060.path 1.1 0.79375 -1 0.6
../bin/path_rml testpattern-045-060.path testpattern-045-060.rml 4 15 15 -0.45
../bin/png_path testpattern.png testpattern-045-070.path 1.1 0.79375 -1 0.7
../bin/path_rml testpattern-045-070.path testpattern-045-070.rml 4 30 15 -0.45
../bin/png_path testpattern.png testpattern-045-080.path 1.1 0.79375 -1 0.8
../bin/path_rml testpattern-045-080.path testpattern-045-080.rml 4 45 15 -0.45

../bin/png_path testpattern.png testpattern-050-050.path 1.1 0.79375 -1 0.5
../bin/path_rml testpattern-050-050.path testpattern-050-050.rml 4 0 30 -0.5
../bin/png_path testpattern.png testpattern-050-060.path 1.1 0.79375 -1 0.6
../bin/path_rml testpattern-050-060.path testpattern-050-060.rml 4 15 30 -0.5
../bin/png_path testpattern.png testpattern-050-070.path 1.1 0.79375 -1 0.7
../bin/path_rml testpattern-050-070.path testpattern-050-070.rml 4 30 30 -0.5
../bin/png_path testpattern.png testpattern-050-080.path 1.1 0.79375 -1 0.8
../bin/path_rml testpattern-050-080.path testpattern-050-080.rml 4 45 30 -0.5

cat testpattern-*.rml > testpattern.rml

rm testpattern-*.path 2>/dev/null
rm testpattern-*.rml 2>/dev/null