FROM oci-release.devops.etat-ge.ch/ch/ge/common/middlewares/web/nginx.122-ubi9:1.0.6

USER root

#copie l'application dans le document root
COPY ./target/dist /srv/www/html/sema

#Change user
USER 1001

# Run the Nginx server
CMD nginx -g "daemon off;"
