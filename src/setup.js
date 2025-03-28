
//SETUP/TEST
(async () => {
    const accessToken = await getData('accessToken');
    if (accessToken) {

        //await pruneDupes('deployments')

        /*  await refreshTokenIfAboutToExpire(accessToken, await getData('refreshToken'));
         process.exit(0); */

        /* const subscriptions = await getExistingSubscriptions(accessToken);
        console.log('Existing Subscriptions:', subscriptions);
         */


        /*   let subscriptionId = await checkAndCreateSubscription(accessToken, '48:notes', process.env.WEBHOOK_URL)
  
          if(subscriptionId) {
              console.log('Final subscription ID:', subscriptionId)
          } */

        /*  let chatId = '48:notes'
         let messages = await getLatestMessages(accessToken, chatId)
         console.log(`Fetched messages`,{
             messages: messages.map(message => ({
                 from: message.from.user.displayName,
                 content: message.body.content,
                 createdAt: message.createdDateTime
             })),
         }) */
    }
})();