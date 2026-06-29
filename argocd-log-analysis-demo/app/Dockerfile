FROM python:3.9-slim

WORKDIR /app

# The version is baked in at build time (no runtime env/flag), so the running
# container exposes nothing that marks it as a demo — only the image tag differs.
ARG VERSION=1
RUN echo "VERSION = \"${VERSION}\"" > /app/version.py

COPY app.py /app/app.py

EXPOSE 8080
CMD ["python", "/app/app.py"]
