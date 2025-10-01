const fileNames = [
    '00.json', '01.json', '02.json', '03.json', '04.json', '05.json',
    '06.json', '07.json', '08.json', '09.json', '10.json', '11.json',
    '12.json', '13.json', '14.json', '15.json', '16.json', '17.json',
    '18.json', '19.json', '20.json', '21.json', '22.json', '23.json'
];

// Your Cloudflare Worker URL
const WORKER_BASE_URL = 'https://windborne-systems-job-application.ninamirf.workers.dev';

export const loadFiles = () => {
    const readers = fileNames.map(item => 
        d3.json(`${WORKER_BASE_URL}/${item}`)
    );

    return Promise.allSettled(readers)
        .then((results) => {
            results.filter(({ status }) => status === 'rejected')
                .forEach(({ reason }) => console.error('Failed to load:', reason));

            const data = results.filter(({ status }) => status === 'fulfilled')
                .map(({ value }) => value);

            return data;
        })
        .catch((error) => {
            console.error('Error loading files:', error);
            throw error;
        });
};