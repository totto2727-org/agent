# Output details

Text and JSON use the same ordered records: LF or CRLF separates names, and empty records are omitted.
Text joins those records with LF. JSON serializes them as an array.
Spaces in job names and bare CR characters that are not followed by LF are data, not whitespace to trim.
