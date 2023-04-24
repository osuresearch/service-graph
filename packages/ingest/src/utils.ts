
/**
 * @author GPT-4 - accessed 4/23/2023
 */
export function updateObjectByJSONPath(jsonPath: string, obj: Record<string, any>, value: any) {
  let path = jsonPath.replace('$', '').split(/[\.\[\]]/).filter(p => p);
  let current = obj;

  for (let i = 0; i < path.length - 1; i++) {
    let prop: string | number = path[i];
    if (!isNaN(parseInt(prop))) {
      prop = parseInt(prop);
    }
    if (!current[prop]) {
      current[prop] = isNaN(parseInt(path[i + 1])) ? {} : [];
    }
    current = current[prop];
  }

  let lastProp: string | number = path[path.length - 1];

  if (!isNaN(parseInt(lastProp))) {
    lastProp = parseInt(lastProp);
  }

  // Check if the value is a stringified JSON object
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch (e) {}
  }

  current[lastProp] = value;
}
