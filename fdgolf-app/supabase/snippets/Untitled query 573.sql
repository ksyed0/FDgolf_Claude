update auth.users
set encrypted_password = crypt('13coinstreet', gen_salt('bf'))
where email = 'ksyed0@gmail.com';