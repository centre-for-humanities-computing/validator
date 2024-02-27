/**
 * @param {...string} elements
 */
export function joinPropPaths(...elements) {
    // we do it manually instead of using filter and Array.join(), this is faster
    let result = '';
    for (let element of elements) {
        if (element.length === 0) {
            continue;
        }
        if (result.length > 0) {
            if (element.startsWith('[')) {
                result += element;
            } else {
                result += '.' + element;
            }
        } else {
            result = element;
        }
    }
    return result;
}

/**
 * @param {string} fullPath the full path
 * @param {string} currentPath the current path to get the parent for
 * @returns {string}
 */
export function getParentPath(fullPath, currentPath) {
    if (fullPath.endsWith(currentPath)) {
        let dotCorrection = 0;
        if (fullPath.length > currentPath.length && fullPath[fullPath.length - 1 - currentPath.length] === '.') {
            dotCorrection = 1;
        }
        return fullPath.substring(0, fullPath.length - currentPath.length - dotCorrection);
    } else { // in some cases the fullPath can differ from the currentPath because of errorContextPath modifications, in these cases just target nearest "."
        let lastDot = fullPath.lastIndexOf('.');
        if (lastDot === -1) {
            return "";
        }
        return fullPath.substring(0, lastDot);
    }
}
