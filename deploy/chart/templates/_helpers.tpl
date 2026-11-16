{{/* Labels every object carries; app.kubernetes.io/component says which part of the shop it is. */}}
{{- define "shop.labels" -}}
app.kubernetes.io/part-of: sally-manders
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{/* No privilege escalation, no Linux capabilities, a read-only root: for the shop's own containers. */}}
{{- define "shop.restricted" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities:
  drop: ["ALL"]
{{- end -}}
