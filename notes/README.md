# Flexprice SaaS Assignment Documentation

This document logs the implementation details, setup procedures, and troubleshooting steps encountered during development.

---

## Part 0 — Troubleshooting & Setup Notes

During the initial local setup of Flexprice, we encountered and resolved two critical issues:

### 1. PostgreSQL Port Collision (`5432`)
* **Symptom**: The `postgres` container failed to boot and exited with the following error:
  ```text
  failed to bind port 127.0.0.1:5432/tcp: listen tcp4 127.0.0.1:5432: bind: address already in use
  ```
* **Cause**: The host machine had an active local PostgreSQL server already listening on the default port `5432`.
* **Resolution**: 
  We modified the `ports` mapping in the [docker-compose.yml](file:///d:/Assingment/flexprice/docker-compose.yml) file to bind the host machine's port `5435` to the container's internal port `5432`:
  ```yaml
  postgres:
    image: postgres:17
    ports:
      - 127.0.0.1:5435:5432
  ```
  This allowed the container to bind successfully without host conflicts, while internal services inside the Docker Compose network (like `temporal` and `flexprice-api`) can still connect to PostgreSQL on the virtual network using standard port `5432`.

### 2. Shell Script Line Endings (CRLF vs. LF)
* **Symptom**: The PostgreSQL database initialized but immediately crashed with exit code `127`. The container logs showed:
  ```text
  /usr/local/bin/docker-entrypoint.sh: line 185: /docker-entrypoint-initdb.d/init-temporal-db.sh: cannot execute: required file not found
  ```
* **Cause**: Git cloned the repository with Windows-style carriage returns (`CRLF` / `\r\n`) for text files on the host machine. When Docker mounted `./migrations/postgres` inside the Linux-based Alpine container, `/bin/bash` failed to parse the shebang (`#!/bin/bash\r`) because of the trailing `\r`.
* **Resolution**:
  1. We ran a Python script to convert the line endings of the shell scripts (`init-temporal-db.sh`) from CRLF to LF:
     ```python
     with open("init-temporal-db.sh", "rb") as f:
         content = f.read().replace(b"\r\n", b"\n")
     with open("init-temporal-db.sh", "wb") as f:
         f.write(content)
     ```
  2. We cleaned the corrupted state and volumes:
     ```bash
     docker compose down -v
     ```
  3. We rebuilt/restarted the compose stack, allowing PostgreSQL to run the initialization scripts cleanly on first boot.
