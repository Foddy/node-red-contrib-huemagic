function mergeDeep(...objects)
{
    // CLEANUP FROM HTTP NODE
    delete objects.req;
    delete objects.res;

    // BEGIN MERGING …
    const isObject = obj => obj && typeof obj === 'object';
    return objects.reduce((prev, obj) =>
    {
        Object.keys(obj).forEach(key =>
        {
            const pVal = prev[key];
            const oVal = obj[key];

            // AN UPDATE REPLACES A LIST, IT NEVER APPENDS TO IT
            if(Array.isArray(oVal))
            {
                prev[key] = oVal;
            }
            else if (isObject(pVal) && isObject(oVal))
            {
                prev[key] = mergeDeep(pVal, oVal);
            }
            else
            {
                prev[key] = oVal;
            }
        });

        return prev;
    }, {});
}

// EXPORT
module.exports.deep = mergeDeep;