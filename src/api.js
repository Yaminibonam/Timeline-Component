// API helper functions for Timeline
const API_BASE = "http://138.68.140.83:8080/yaminib";

export async function fetchTable(tableName) {
    const res = await fetch(`${API_BASE}/getTableData.jsp?tableName=${tableName}`);
    if (!res.ok) throw new Error(`Failed to fetch ${tableName}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    if (!Array.isArray(json.columns) || !Array.isArray(json.data)) return [];
    return json.data.map(row => {
        const obj = {};
        json.columns.forEach((colName, idx) => {
            obj[colName] = row[idx];
        });
        return obj;
    });
}

export async function saveRecord(tableName, columns, values) {
    const params = new URLSearchParams();
    params.append("tableName", tableName);
    columns.forEach(c => params.append("columns[]", c));
    values.forEach(v => params.append("values[]", v));
    const res = await fetch(`${API_BASE}/saveRecord.jsp`, {
        method: "POST",
        body: params
    });
    return res.json();
}

export async function deleteRecord(tableName, fieldName, fieldValue) {
    const params = new URLSearchParams();
    params.append("tableName", tableName);
    params.append("fieldName", fieldName);
    params.append("fieldValue", fieldValue);
    const res = await fetch(`${API_BASE}/deleteRecord.jsp`, {
        method: "POST",
        body: params
    });
    return res.json();
}
