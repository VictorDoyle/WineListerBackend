require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(bodyParser.json());

// init Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// signup Route
app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // supabase only cares bout email + password, name etc inserted after auth
        /* ANCHOR: Step 1 is to sign up user */
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
            console.error('Supabase Error:', error); // log to CLI too
            //tested too hard so keep this for graceful exit out of rate limting
            if (error.message.includes('rate limit')) {
                return res.status(429).json({ message: 'Rate limit exceeded. Please try again later.' });
            }
            return res.status(400).json({ message: error.message });
        }

        /* ANCHOR: Step 2 give auth to signedup user */
        const { session, user } = data;
        const accessToken = session?.access_token;

        if (!accessToken) {
            return res.status(400).json({ message: 'Authentication failed. No access token available.' });
        }

        /* ANCHOR: Step 3 new supabase client with the auth header */
        const supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        /* ANCHOR: Step 4 insert user into profiles db */
        const { id } = data.user; // extract userId from the auth res
        const { error: updateError } = await supabaseClient
            .from('userprofiles')
            .insert([{ id, name, email }]);

        if (updateError) {
            console.error('Update Error:', updateError);
            console.error('update error triggered with the following data', `id: ${id} / id2: ${data.user.id}, name: ${name}, email: ${email}, full data: ${data}, data-user: ${data.user}`);
            return res.status(400).json({ message: updateError.message });
        }

        res.status(201).json({ message: 'User created successfully', user: data.user });
    } catch (error) {
        console.error('Signup Error:', error);
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
});



// login route 
// TODO: add err logging to cli once signup is fixed post limiting
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        return res.status(401).json({ message: error.message });
    }

    res.json({ message: 'Login successful', session: data.session });
});

// keep to 5001 for now then switch dev || prod ? alpha
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
