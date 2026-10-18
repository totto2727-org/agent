# Nix Systems

| Scope                   | Standard                                                                    |
| ----------------------- | --------------------------------------------------------------------------- |
| NixOS host              | [NixOS modules](https://nixos.org/manual/nixos/stable/).                    |
| macOS system            | [nix-darwin](https://github.com/nix-darwin/nix-darwin).                     |
| User environment        | [Home Manager](https://nix-community.github.io/home-manager/).              |
| Package-set composition | [Nixpkgs overlays](https://nixos.org/manual/nixpkgs/stable/#chap-overlays). |

Secret values in expressions or derivation arguments can enter the Nix store.
